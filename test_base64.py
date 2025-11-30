import base64
import requests
import cv2
import json

# Load image and convert to base64
img_path = 'IMG-20251130-WA0005.jpg'
with open(img_path, "rb") as image_file:
    encoded_string = base64.b64encode(image_file.read()).decode('utf-8')

# Prepare payload
payload = {'image': encoded_string}

try:
    response = requests.post('http://127.0.0.1:5000/process', json=payload)
    if response.status_code == 200:
        print("Success! Response received.")
        data = response.json()
        print(f"Intensity points: {len(data['intensity'])}")
    else:
        print(f"Failed: {response.status_code} - {response.text}")
except Exception as e:
    print(f"Connection failed: {e}")
