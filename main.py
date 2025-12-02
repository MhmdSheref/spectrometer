import cv2
import numpy as np
from scipy.signal import find_peaks
from scipy.ndimage import gaussian_filter1d

def load_image(image_path):
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Could not load {image_path}")
    return img

def extract_intensity_from_crop(img, crop_rect):
    """
    Extracts intensity profile from a specific cropped region.
    crop_rect: (x, y, w, h)
    """
    x, y, w, h = crop_rect
    
    # Ensure bounds
    img_h, img_w = img.shape[:2]
    x = max(0, min(x, img_w - 1))
    y = max(0, min(y, img_h - 1))
    w = max(1, min(w, img_w - x))
    h = max(1, min(h, img_h - y))
    
    roi = img[y:y+h, x:x+w]
    
    # Physics Check: Auto-flip if Blue is on the right
    # Heuristic: Blue channel center of mass vs Red channel center of mass
    r_ch = roi[:, :, 2] # OpenCV is BGR, so 2 is Red
    b_ch = roi[:, :, 0] # OpenCV is BGR, so 0 is Blue
    
    x_indices = np.arange(roi.shape[1])
    blue_center = np.sum(x_indices * np.sum(b_ch, axis=0)) / (np.sum(b_ch) + 1e-5)
    red_center = np.sum(x_indices * np.sum(r_ch, axis=0)) / (np.sum(r_ch) + 1e-5)
    
    is_flipped = False
    if red_center < blue_center:
        roi = cv2.flip(roi, 1)
        is_flipped = True

    # Extract channels using Top-N Average method
    # For each vertical column, take the brightest 30% of pixels and average them
    # This gives 0-255 range, is crop-height independent, and filters noise
    
    def top_n_average(column, percentile=70):
        """
        Returns the average of the top (100-percentile)% brightest pixels.
        percentile=70 means top 30% brightest pixels.
        """
        if len(column) == 0:
            return 0
        threshold = np.percentile(column, percentile)
        top_pixels = column[column >= threshold]
        return np.mean(top_pixels) if len(top_pixels) > 0 else 0
    
    # Apply to each column (wavelength position)
    b_curve = np.array([top_n_average(roi[:, i, 0]) for i in range(roi.shape[1])])
    g_curve = np.array([top_n_average(roi[:, i, 1]) for i in range(roi.shape[1])])
    r_curve = np.array([top_n_average(roi[:, i, 2]) for i in range(roi.shape[1])])
    
    # Total Intensity as average of all three channels
    intensity_curve = (r_curve + g_curve + b_curve) / 3.0
    
    # Values are now in true 0-255 range and independent of crop height
    return {
        "blue": b_curve.tolist(),
        "green": g_curve.tolist(),
        "red": r_curve.tolist(),
        "intensity": intensity_curve.tolist(),
        "flipped": is_flipped,
        "width": roi.shape[1]
    }

def detect_peaks_in_data(wavelengths, data):
    """
    Finds the global peak (max intensity) for Red, Green, Blue, and Total Intensity channels.
    data: dict containing 'red', 'green', 'blue', 'intensity' arrays
    """
    peaks = {}
    
    # Include total intensity alongside RGB channels
    for channel in ['red', 'green', 'blue', 'intensity']:
        if channel in data and data[channel] and len(data[channel]) > 0:
            arr = np.array(data[channel])
            max_idx = np.argmax(arr)
            max_val = arr[max_idx]
            
            # Threshold to ignore noise (values are now in 0-255 range)
            threshold = 10  # Minimum intensity to consider as a real peak
            if max_val > threshold: 
                peaks[channel] = {
                    "index": int(max_idx),
                    "wavelength": float(wavelengths[max_idx]),
                    "intensity": float(max_val)
                }
    
    return peaks

def calibrate_pixel_to_wavelength(pixel_indices, known_wavelengths, total_pixels):
    """
    Linear fit: wavelength = m * pixel + c
    """
    if len(pixel_indices) < 2:
        # Default fallback
        return np.linspace(380, 750, total_pixels).tolist()
        
    z = np.polyfit(pixel_indices, known_wavelengths, 1)
    p = np.poly1d(z)
    
    x_axis = np.arange(total_pixels)
    y_axis = p(x_axis)
    return y_axis.tolist()

def auto_calibrate_from_white_light(red_channel, green_channel, blue_channel):
    """
    Automatically calibrates wavelength using RGB channel peaks from white light.
    
    Args:
        red_channel: list/array of red intensity values
        green_channel: list/array of green intensity values
        blue_channel: list/array of blue intensity values
    
    Returns:
        dict with keys:
            - success: bool
            - pixel_positions: [blue_px, green_px, red_px]
            - reference_wavelengths: [470, 535, 610]
            - confidence: float (0.0-1.0)
            - peaks: dict with peak info
            - error: str (if success=False)
    """
    try:
        # Convert to numpy arrays
        r_arr = np.array(red_channel)
        g_arr = np.array(green_channel)
        b_arr = np.array(blue_channel)
        
        # Smooth channels to reduce noise (Gaussian filter with sigma=3)
        r_smooth = gaussian_filter1d(r_arr, sigma=3)
        g_smooth = gaussian_filter1d(g_arr, sigma=3)
        b_smooth = gaussian_filter1d(b_arr, sigma=3)
        
        # Find peak positions using weighted centroid for sub-pixel accuracy
        def find_peak_centroid(arr, window=20):
            """Find peak using weighted centroid around maximum"""
            max_idx = np.argmax(arr)
            
            # Define window around peak
            start = max(0, max_idx - window)
            end = min(len(arr), max_idx + window)
            
            # Calculate centroid
            indices = np.arange(start, end)
            weights = arr[start:end]
            
            if np.sum(weights) > 0:
                centroid = np.sum(indices * weights) / np.sum(weights)
                peak_intensity = arr[max_idx]
                return centroid, peak_intensity
            else:
                return max_idx, arr[max_idx]
        
        b_peak, b_intensity = find_peak_centroid(b_smooth)
        g_peak, g_intensity = find_peak_centroid(g_smooth)
        r_peak, r_intensity = find_peak_centroid(r_smooth)
        
        # Validate: peaks should be in order blue < green < red
        if not (b_peak < g_peak < r_peak):
            return {
                "success": False,
                "error": "RGB peaks are not in expected order. Ensure spectrum is from blue (left) to red (right).",
                "confidence": 0.0
            }
        
        # Validate: minimum peak separation (at least 30 pixels between adjacent peaks)
        if (g_peak - b_peak < 30) or (r_peak - g_peak < 30):
            return {
                "success": False,
                "error": "Peaks are too close together. Use a wider spectrum or better light source.",
                "confidence": 0.2
            }
        
        # Calculate confidence score based on peak distinctness
        # Higher confidence if peaks are well-separated and have good intensity
        separation_score = min(1.0, ((g_peak - b_peak) + (r_peak - g_peak)) / 400.0)
        
        # Intensity ratio score (good white light should have balanced RGB)
        intensities = np.array([r_intensity, g_intensity, b_intensity])
        intensity_ratio = np.min(intensities) / (np.max(intensities) + 1e-5)
        
        confidence = 0.5 * separation_score + 0.5 * intensity_ratio
        
        # Reference wavelengths for typical RGB sensor peaks
        REFERENCE_WAVELENGTHS = {
            'blue': 470,   # nm
            'green': 535,  # nm
            'red': 610     # nm
        }
        
        pixel_positions = [b_peak, g_peak, r_peak]
        reference_wavelengths = [
            REFERENCE_WAVELENGTHS['blue'],
            REFERENCE_WAVELENGTHS['green'],
            REFERENCE_WAVELENGTHS['red']
        ]
        
        return {
            "success": True,
            "pixel_positions": pixel_positions,
            "reference_wavelengths": reference_wavelengths,
            "confidence": float(confidence),
            "peaks": {
                "blue": {"pixel": float(b_peak), "wavelength": REFERENCE_WAVELENGTHS['blue'], "intensity": float(b_intensity)},
                "green": {"pixel": float(g_peak), "wavelength": REFERENCE_WAVELENGTHS['green'], "intensity": float(g_intensity)},
                "red": {"pixel": float(r_peak), "wavelength": REFERENCE_WAVELENGTHS['red'], "intensity": float(r_intensity)}
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"Auto-calibration failed: {str(e)}",
            "confidence": 0.0
        }