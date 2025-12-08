# Optical Spectrometer Interface

A web-based optical spectrometer interface that transforms your camera or uploaded images into a powerful spectral analysis tool. This application allows for real-time visualization, calibration, and analysis of light spectra.

## Features

-   **Live Camera Feed**: Analyze spectra in real-time using your device's camera.
-   **Image Upload**: Process existing images for spectral data.
-   **Smart Cropping**: Custom crop and rotate tools to isolate the spectrum from the video feed.
-   **Real-time Visualization**: Interactive chart showing intensity vs. wavelength with dynamic rainbow gradients.
-   **Calibration**:
    -   **Auto-Calibration**: Automatically map pixels to nanometers using a standard white light source (CFL/LED).
    -   **Manual Calibration**: Calibrate using a known laser wavelength.
-   **Peak Detection**: Automatically identify and highlight spectral peaks.
-   **Data Export**: Download your spectral data and detected peaks as a CSV file.

## Prerequisites

Ensure you have the following installed:

-   **Python 3.7+**
-   **pip** (Python package manager)

## Installation

1.  **Clone the repository** (or download the source code):
    ```bash
    git clone <repository-url>
    cd spectrometer
    ```

2.  **Install dependencies**:
    ```bash
    pip install flask opencv-python numpy scipy
    ```

## Usage

1.  **Start the application**:
    ```bash
    python app.py
    ```

2.  **Open the interface**:
    Open your web browser and navigate to `http://localhost:5050`.

3.  **Analyze a Spectrum**:
    -   **Source**: Select "Use Camera" for live analysis or "Upload Image" to load a file.
    -   **Adjust**:
        -   Use the **Rotation Slider** to ensure the spectrum is horizontal.
        -   Drag and resize the **Crop Box** to frame *only* the spectrum part of the image.
    -   **Process**:
        -   Click **"Process Frame"** for a single snapshot.
        -   Click **"Start Live"** for continuous real-time analysis.
    -   **Calibrate** (Important for accurate nm readings):
        -   *Method A (White Light)*: Point the camera at a white light source (like a CFL bulb) and click **"Auto Calibrate"**.
        -   *Method B (Laser)*: Shine a known laser (e.g., Green 532nm), ensure the crop box captures it, enter "532" in the input box, and click **"Calibrate"**.
    -   **View Data**: The chart will display the spectral intensity. Toggle **"Auto-detect Peaks"** to see peak values.
    -   **Export**: Click **"Save CSV"** to download the analysis data.

## Project Structure

-   **`app.py`**: The Flask backend server. Handles routing, image processing requests, and API endpoints.
-   **`main.py`**: Core logic for image processing, intensity extraction, and calibration algorithms.
-   **`static/`**: Frontend assets.
    -   `script.js`: Main frontend logic (UI, chart, API calls).
    -   `style.css`: Styling for the application.
    -   `index.html`: The main user interface.
-   **`uploads/`**: Temporary storage for uploaded images.

## API Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/process` | POST | Accepts a base64 image, returns intensity arrays (R, G, B, Total). |
| `/auto_calibrate` | POST | Accepts RGB channel data, returns calibration parameters based on white light peaks. |
| `/peaks` | POST | Accepts spectral data, returns detected peak locations. |
| `/calibrate` | POST | (Legacy) Manual calibration endpoint. |
