import cv2
import numpy as np
from scipy.signal import find_peaks

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

    # Extract channels
    b_curve = np.sum(roi[:, :, 0], axis=0)
    g_curve = np.sum(roi[:, :, 1], axis=0)
    r_curve = np.sum(roi[:, :, 2], axis=0)
    
    # Total Intensity as average of all three channels (more accurate for spectroscopy)
    intensity_curve = (r_curve + g_curve + b_curve) / 3.0
    
    # Normalize all channels together using global maximum
    # This ensures all four curves (R, G, B, and Total) share the same 0-1 scale
    global_max = max(np.max(r_curve), np.max(g_curve), np.max(b_curve))
    
    def normalize_with_global_max(arr, global_max):
        return (arr / global_max).tolist() if global_max > 0 else arr.tolist()

    return {
        "blue": normalize_with_global_max(b_curve, global_max),
        "green": normalize_with_global_max(g_curve, global_max),
        "red": normalize_with_global_max(r_curve, global_max),
        "intensity": normalize_with_global_max(intensity_curve, global_max),
        "flipped": is_flipped,
        "width": roi.shape[1]
    }

def detect_peaks_in_data(wavelengths, data):
    """
    Finds the global peak (max intensity) for Red, Green, and Blue channels.
    data: dict containing 'red', 'green', 'blue' arrays
    """
    peaks = {}
    
    for channel in ['red', 'green', 'blue']:
        if channel in data and data[channel] and len(data[channel]) > 0:
            arr = np.array(data[channel])
            max_idx = np.argmax(arr)
            max_val = arr[max_idx]
            
            # Threshold to ignore noise
            if max_val > 0.1: 
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