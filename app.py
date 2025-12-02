import os
import cv2
import json
import base64
import numpy as np
from flask import Flask, request, jsonify, send_from_directory
from main import load_image, extract_intensity_from_crop, calibrate_pixel_to_wavelength, detect_peaks_in_data

app = Flask(__name__, static_folder='static', template_folder='templates')

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file:
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
        file.save(filepath)
        return jsonify({'filename': file.filename, 'url': f'/uploads/{file.filename}'})

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/process', methods=['POST'])
def process_image():
    data = request.json
    image_data = data.get('image') # Base64 string
    
    if not image_data:
        return jsonify({'error': 'Missing image data'}), 400
        
    try:
        # Decode base64
        if ',' in image_data:
            header, encoded = image_data.split(",", 1)
        else:
            encoded = image_data
            
        nparr = np.frombuffer(base64.b64decode(encoded), np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
             return jsonify({'error': 'Failed to decode image'}), 400

        # We assume the frontend sends the ALREADY CROPPED image
        # So we just extract intensity from the whole image
        # We pass a "full crop" rect: (0, 0, w, h)
        h, w = img.shape[:2]
        result = extract_intensity_from_crop(img, (0, 0, w, h))
        
        # Initial default calibration (linear 380-750)
        wavelengths = np.linspace(380, 750, len(result['intensity'])).tolist()
        result['wavelengths'] = wavelengths
        
        return jsonify(result)
    except Exception as e:
        print(e)
        return jsonify({'error': str(e)}), 500

@app.route('/calibrate', methods=['POST'])
def calibrate():
    data = request.json
    points = data.get('points') # List of {pixel: 123, nm: 532}
    total_pixels = data.get('total_pixels')
    
    if not points or not total_pixels:
        return jsonify({'error': 'Missing calibration data'}), 400
        
    pixel_indices = [p['pixel'] for p in points]
    known_wavelengths = [p['nm'] for p in points]
    
    new_wavelengths = calibrate_pixel_to_wavelength(pixel_indices, known_wavelengths, total_pixels)
    return jsonify({'wavelengths': new_wavelengths})


@app.route('/auto_calibrate', methods=['POST'])
def auto_calibrate():
    """
    Automatically calibrates wavelength using white light spectrum and RGB peaks.
    
    Input: {red: [...], green: [...], blue: [...]}
    Output: {
        success: bool,
        nmPerPixel: float,
        wavelengthOffset: float,
        confidence: float,
        peaks: {red: {...}, green: {...}, blue: {...}},
        error: str (if failed)
    }
    """
    data = request.json
    red = data.get('red')
    green = data.get('green')
    blue = data.get('blue')
    
    if not red or not green or not blue:
        return jsonify({'success': False, 'error': 'Missing RGB channel data'}), 400
    
    from main import auto_calibrate_from_white_light
    
    # Call auto-calibration function
    result = auto_calibrate_from_white_light(red, green, blue)
    
    if not result['success']:
        return jsonify(result), 200
    
    # Calculate nmPerPixel and wavelengthOffset using linear fit
    pixel_positions = result['pixel_positions']
    reference_wavelengths = result['reference_wavelengths']
    
    # Linear least-squares fit: wavelength = m * pixel + c
    # Using numpy polyfit (degree 1 = linear)
    z = np.polyfit(pixel_positions, reference_wavelengths, 1)
    slope = z[0]  # nm per pixel
    intercept = z[1]  # wavelength at pixel 0
    
    # Calculate parameters in the format expected by frontend
    # Frontend uses: wavelength = (pixel * nmPerPixel) + wavelengthOffset + 380
    # We have: wavelength = slope * pixel + intercept
    # So: nmPerPixel = slope, wavelengthOffset = intercept - 380
    nmPerPixel = float(slope)
    wavelengthOffset = float(intercept - 380)
    
    result['nmPerPixel'] = nmPerPixel
    result['wavelengthOffset'] = wavelengthOffset
    
    return jsonify(result)

@app.route('/peaks', methods=['POST'])
def get_peaks():
    data = request.json
    wavelengths = data.get('wavelengths')
    # We need the full data object (red, green, blue, intensity)
    # The frontend sends 'intensity' but we need more.
    # Let's expect the frontend to send the whole 'currentData' object or specific channels.
    # For simplicity, let's accept 'red', 'green', 'blue', 'intensity' arrays.
    
    red = data.get('red')
    green = data.get('green')
    blue = data.get('blue')
    intensity = data.get('intensity')  # Add total intensity
    
    if not wavelengths:
        return jsonify({'error': 'Missing wavelength data'}), 400
        
    # Construct data dict
    input_data = {
        'red': red,
        'green': green,
        'blue': blue,
        'intensity': intensity  # Include total intensity for peak detection
    }
    
    peaks = detect_peaks_in_data(wavelengths, input_data)
    return jsonify({'peaks': peaks})


if __name__ == '__main__':
    app.run(debug=True, port=5050)
