import cv2
from main import extract_intensity_from_crop

# Load a sample image
img_path = 'IMG-20251130-WA0005.jpg'
img = cv2.imread(img_path)

if img is None:
    print("Error: Image not found.")
else:
    # Simulate a crop (center of image)
    h, w = img.shape[:2]
    crop_rect = (w//4, h//2 - 50, w//2, 100) # x, y, w, h
    
    try:
        result = extract_intensity_from_crop(img, crop_rect)
        print("Success! Extracted intensity data.")
        print(f"Data length: {len(result['intensity'])}")
        print(f"Flipped: {result['flipped']}")
    except Exception as e:
        print(f"Failed: {e}")
