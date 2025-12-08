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

## Hardware Setup: DIY Pringles Can Spectrometer

You can build a fully functional spectrometer using household items!

1.  **The Body**: Take a standard **Pringles can** (or any long tube).
2.  **Light Slit**: Cut a very thin slit at the bottom metal end of the can. This allows a narrow beam of light to enter.
3.  **Viewing Port**: Cut a small viewing hole on the side of the can, near the top (plastic lid end).
4.  **Diffraction Grating**:
    -   Take an old **CD** or DVD.
    -   Cut a piece of the CD.
    -   Insert it into the can through the viewing hole (or a separate slot) and secure it at a **45-degree angle**.
5.  **Alignment**: Ensure that light entering the slit hits the CD and reflects/diffracts towards the viewing hole.
6.  **Connect**: Place your phone camera or webcam against the viewing hole to capture the spectrum.

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


##  Contributors

<div align="center">

###  Team Members

<table>
<tr>
<td align="center">
<a href="https://github.com/MhmdSheref">
<img src="https://github.com/MhmdSheref.png" width="100px;" alt="MhmdSheref"/><br />
<sub><b>MhmdSheref</b></sub></a>

</td>

<td align="center">
<a href="https://github.com/BasselM0stafa">
<img src="https://github.com/BasselM0stafa.png" width="100px;" alt="BasselM0stafa"/><br />
<sub><b>Bassel Mostafa</b></sub></a>
</td>

<td align="center">
<a href="https://github.com/MahmoudZah">
<img src="https://github.com/MahmoudZah.png" width="100px;" alt="MahmoudZah"/><br />
<sub><b>Mahmoud Zahran</b></sub></a>

</td>

</tr>
<tr>

<td align="center">
<a href="https://github.com/RwanOtb">
<img src="https://github.com/RwanOtb.png" width="100px;" alt="RwanOtb"/><br />
<sub><b>RwanOtb</b></sub></a>
</td>

<td align="center">
<a href="https://github.com/rahmashraf">
<img src="https://github.com/rahmashraf.png" width="100px;" alt="rahmashraf"/><br />
<sub><b>rahmashraf</b></sub></a>
</td>

<td align="center">
<br /><br /><br /><br /><br />
<sub><b>Mahmoud Mazen</b></sub>
</td>

</tr>
</table>

                                        
</div>   

# Supervised By

* **Eng. Amira Omar**   