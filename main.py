import cv2
import numpy as np
import matplotlib.pyplot as plt


def advanced_spectrum_extract(image_path):
    # --- 1. Load Image ---
    img = cv2.imread(image_path)
    if img is None:
        print(f"Error: Could not load {image_path}")
        return

    # Work with a copy for visualization later
    debug_img = img.copy()

    # Pre-processing: Blur slightly to remove camera noise
    blurred = cv2.GaussianBlur(img, (5, 5), 0)
    hsv = cv2.cvtColor(blurred, cv2.COLOR_BGR2HSV)

    # --- 2. Smart Filtering (Morphology) ---
    # Create mask of "Everything that emits light"
    mask_bright = cv2.inRange(hsv, (0, 0, 30), (180, 255, 255))

    # "Close" the mask to connect rgb parts
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 25))
    mask_closed = cv2.morphologyEx(mask_bright, cv2.MORPH_CLOSE, kernel)

    # --- 3. Locate Objects ---
    contours, _ = cv2.findContours(mask_closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        print("No light sources detected.")
        return

    # --- 4. The Logic: Find the "Rainbow-est" Object ---
    best_contour = None
    max_score = -1

    for i, cnt in enumerate(contours):
        if cv2.contourArea(cnt) < 500: continue  # Filter tiny noise

        # Create a mask for JUST this object
        c_mask = np.zeros_like(mask_closed)
        cv2.drawContours(c_mask, [cnt], -1, 255, -1)

        # Calculate Hue Variance (Rainbows have high variance, white light has low)
        mean, std_dev = cv2.meanStdDev(hsv, mask=c_mask)
        hue_std = std_dev[0][0]
        sat_mean = mean[1][0]

        score = hue_std * sat_mean  # Heuristic Score

        # Debug visualization
        rect = cv2.minAreaRect(cnt)
        box = cv2.boxPoints(rect)
        box = np.int32(box)  # Fixed for newer NumPy
        cv2.drawContours(debug_img, [box], 0, (0, 255, 255), 2)

        if score > max_score:
            max_score = score
            best_contour = cnt

    if best_contour is None:
        print("Could not distinguish spectrum from noise.")
        return

    # --- 5. ROBUST ROTATION ---
    rect = cv2.minAreaRect(best_contour)
    (center_x, center_y), (w, h), angle = rect

    # Force "Landscape" orientation
    if w < h:
        angle = angle + 90
        w, h = h, w

    M = cv2.getRotationMatrix2D((center_x, center_y), angle, 1.0)
    (img_h, img_w) = img.shape[:2]

    # Rotate image and mask
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    rotated_img = cv2.warpAffine(img_rgb, M, (img_w, img_h))

    best_mask = np.zeros_like(mask_closed)
    cv2.drawContours(best_mask, [best_contour], -1, 255, -1)
    rotated_mask = cv2.warpAffine(best_mask, M, (img_w, img_h))

    # --- 6. CROP ---
    y_profile = np.sum(rotated_mask, axis=1)
    x_profile = np.sum(rotated_mask, axis=0)

    y_indices = np.where(y_profile > 0)[0]
    x_indices = np.where(x_profile > 0)[0]

    if len(y_indices) == 0: return

    pad = 10
    y_min, y_max = max(0, y_indices[0] - pad), min(img_h, y_indices[-1] + pad)
    x_min, x_max = max(0, x_indices[0] - pad), min(img_w, x_indices[-1] + pad)

    roi = rotated_img[y_min:y_max, x_min:x_max]

    # --- 7. AUTO-FLIP (Physics Check) ---
    # Check if Blue is on the Right (which is backwards)
    r_ch = roi[:, :, 0]
    b_ch = roi[:, :, 2]

    x_indices = np.arange(roi.shape[1])
    # Calculate center of mass for colors
    blue_center = np.sum(x_indices * np.sum(b_ch, axis=0)) / (np.sum(b_ch) + 1e-5)
    red_center = np.sum(x_indices * np.sum(r_ch, axis=0)) / (np.sum(r_ch) + 1e-5)

    if red_center < blue_center:
        print("Flipping spectrum to standard orientation (Blue->Red)...")
        roi = cv2.flip(roi, 1)

    # --- 8. EXTRACT DATA (The Missing Part) ---
    # Now that ROI is finalized, we calculate the curves
    r = np.sum(roi[:, :, 0], axis=0)
    g = np.sum(roi[:, :, 1], axis=0)
    b = np.sum(roi[:, :, 2], axis=0)

    # Normalize curves (0 to 1)
    r = r / np.max(r)
    g = g / np.max(g)
    b = b / np.max(b)

    # Calculate Total Intensity
    roi_gray = cv2.cvtColor(roi, cv2.COLOR_RGB2GRAY)
    intensity = np.sum(roi_gray, axis=0)
    intensity = intensity / np.max(intensity)

    # --- 9. CALIBRATION & PLOT ---
    # Map pixels to Wavelengths (Approximate Linear)
    START_NM = 350
    END_NM = 800
    num_pixels = len(intensity)
    wavelengths = np.linspace(START_NM, END_NM, num_pixels)

    # Visualization
    fig, axes = plt.subplots(3, 1, figsize=(10, 10), constrained_layout=True)

    # Debug View
    axes[0].imshow(cv2.cvtColor(debug_img, cv2.COLOR_BGR2RGB))
    axes[0].set_title(f"Detected Object (Score: {max_score:.1f})")
    axes[0].axis('off')

    # Spectrum View
    axes[1].imshow(roi, aspect='auto', extent=[START_NM, END_NM, 0, 1])
    axes[1].set_title("Aligned Spectrum")
    axes[1].set_yticks([])
    axes[1].set_xlabel("Wavelength (nm)")

    # Plot View
    axes[2].plot(wavelengths, b, color='blue', label='Blue', alpha=0.8)
    axes[2].plot(wavelengths, g, color='green', label='Green', alpha=0.8)
    axes[2].plot(wavelengths, r, color='red', label='Red', alpha=0.8)
    axes[2].plot(wavelengths, intensity, color='black', label='Total', lw=2)

    axes[2].set_title("Spectral Intensity")
    axes[2].set_xlabel("Wavelength (nanometers)")
    axes[2].set_ylabel("Normalized Intensity")
    axes[2].set_xlim(START_NM, END_NM)
    axes[2].legend(loc='upper right')
    axes[2].grid(True, alpha=0.3)

    plt.show()


# Run
advanced_spectrum_extract('IMG-20251128-WA0002.jpg')