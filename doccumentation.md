# Spectrometer Client Script (`script.js`) Documentation

This document provides a detailed explanation of the `static/script.js` file, which serves as the frontend controller for the Spectrometer application. This script handles user interactions, image processing, real-time visualization, and communication with the backend API.

## Overview

The script transforms a web page into a fully functional optical spectrometer interface. It allows users to:
1.  **Input Data**: Upload images or use a live camera feed.
2.  **Pre-process**: Crop and rotate the input to isolate the spectrum.
3.  **Analyze**: Send image data to the backend for intensity extraction.
4.  **Visualize**: Display spectral data on an interactive chart with accurate wavelength mapping.
5.  **Calibrate**: Map pixels to nanometers (nm) using manual or automatic methods.
6.  **Export**: Save the analyzed data as a CSV file.

---

## Key Components & Logic

### 1. Initialization & DOM Setup
The script waits for the `DOMContentLoaded` event to ensure all HTML elements are available. It initializes references to UI controls (buttons, inputs, sliders) and display areas (video feed, canvas, chart).

### 2. State Management
A set of global variables tracks the application's state:
-   `chartInstance`: The Chart.js instance for the spectrum graph.
-   `currentData`: Stores the latest spectral data received from the backend.
-   `detectedPeaks`: Caches detected peaks for CSV export.
-   `nmPerPixel` & `wavelengthOffset`: Calibration parameters (defaulting to a linear map from 380nm to 750nm).
-   `cropState`: An object tracking the position (`x`, `y`) and dimensions (`width`, `height`) of the crop box, along with drag/resize states.

### 3. Visualization Helpers
-   **`wavelengthToColor(wavelength)`**: Converts a wavelength (in nm) to an approximate RGB color. This is used to create the rainbow gradient effect on the chart, making it visually intuitive.
-   **`updateChartGradient(chart)`**: Dynamically generates a linear gradient for the chart's line stroke based on the currently visible wavelength range.

### 4. Charting (`initChart` & `updateChart`)
The application uses **Chart.js** to render the spectral data.
-   **`initChart()`**: Sets up the line chart with:
    -   **X-Axis**: Wavelength (nm).
    -   **Y-Axis**: Intensity (0-255).
    -   **Datasets**:
        1.  **Total Intensity**: The main spectral curve, colored with the dynamic gradient.
        2.  **R/G/B Channels**: Individual color channels (initially hidden or shown based on user preference).
        3.  **Peaks**: A scatter plot dataset used to highlight detected peaks.
-   **`updateChart(labels, data)`**: Refreshes the chart with new data. It handles:
    -   Updating the X-axis labels (wavelengths).
    -   Updating Y-axis data for all channels.
    -   Dynamically switching the Total Intensity line color between "Gradient" (when RGB channels are hidden) and "Gray" (when RGB channels are visible) to reduce visual clutter.

### 5. Custom Cropping & Rotation System
Unlike standard libraries, this script implements a custom cropping solution to handle **rotated** video feeds correctly.

-   **UI Interaction**:
    -   `mousedown`, `mousemove`, `mouseup` listeners on the `cropBox` allow users to drag the box or resize it using corner handles.
    -   `rotationSlider` updates the CSS `transform: rotate()` property of the preview image/video for visual feedback.

-   **`getCroppedData()`**: This is the core image processing function on the client side. It performs a 3-step process to extract the spectrum:
    1.  **Rotate**: Creates an off-screen canvas and draws the source image/video rotated by the user-specified angle.
    2.  **Map Coordinates**: Translates the on-screen crop box coordinates to the rotated canvas's coordinate system, accounting for scaling differences between the CSS display and the actual media resolution.
    3.  **Extract**: Draws the specific cropped region onto a final canvas. If the crop is vertical (height > width), it automatically rotates it 90 degrees to ensure the spectrum is always analyzed horizontally (left-to-right).
    4.  **Output**: Returns a Base64-encoded JPEG of the isolated spectrum.

### 6. Input Handling
-   **File Upload**: Reads a user-selected file using `FileReader` and displays it on an `<img>` tag.
-   **Camera Mode**: Uses `navigator.mediaDevices.getUserMedia` to access the device camera (preferring the rear/environment camera). It streams video to a `<video>` element.

### 7. Processing Loop
-   **`processFrame(base64Image)`**: Sends the cropped image to the backend `/process` endpoint.
    -   On success: Updates `currentData`, applies the current calibration, and triggers peak detection if "Auto-detect Peaks" is enabled.
-   **Live Mode**: When "Start Live" is clicked, it sets up a `setInterval` (500ms) that repeatedly calls `getCroppedData()` and `processFrame()`, creating a real-time analysis loop.

### 8. Calibration Logic
The script supports two calibration methods to map pixel indices to wavelengths:

#### Manual Calibration
-   **Trigger**: User enters a known wavelength (e.g., a laser at 532nm) and clicks "Calibrate".
-   **Logic**: Finds the pixel with the maximum intensity in the current data and aligns it to the entered wavelength. It adjusts `wavelengthOffset` while keeping the scale (`nmPerPixel`) fixed (or calculated based on a default range).

#### Auto-Calibration (White Light)
-   **Trigger**: "Auto Calibrate" button.
-   **Logic**:
    1.  Sends the current RGB channel data to the backend `/auto_calibrate` endpoint.
    2.  The backend identifies the characteristic peaks of the white light source (Blue ~470nm, Green ~535nm, Red ~610nm).
    3.  **Result**: Returns a calculated `nmPerPixel` (slope) and `wavelengthOffset` (intercept) based on a linear fit of these peaks.
    4.  **Feedback**: Displays a confidence score and visualizes the calibration peaks on the chart.

### 9. Peak Detection
-   **`detectPeaks()`**: Sends the current spectral data to the `/peaks` endpoint.
-   **Visualization**: The backend returns peak locations, which are then plotted as a scatter dataset on the chart.
-   **Storage**: Peaks are stored in `detectedPeaks` for inclusion in the CSV export.

### 10. Data Export
-   **`saveCsvBtn`**: Generates a CSV file containing:
    -   Full spectral data (Wavelength, Total Intensity, R, G, B).
    -   A summary section listing all detected peaks.
-   It uses a hidden `<a>` tag to trigger the browser's download behavior.

---

## Backend API Interaction Summary

The script relies on the following endpoints (defined in `app.py`):

| Endpoint | Method | Payload | Description |
| :--- | :--- | :--- | :--- |
| `/process` | POST | `{ image: "base64..." }` | Extracts intensity arrays (R, G, B, Total) from the image. |
| `/auto_calibrate` | POST | `{ red: [], green: [], blue: [] }` | Calculates calibration parameters using RGB peaks. |
| `/peaks` | POST | `{ wavelengths: [], red: [], ... }` | Detects global peaks in the provided spectral data. |

## Usage Flow
1.  **Select Source**: Upload an image or start the camera.
2.  **Adjust View**: Use the slider to rotate the image so the spectrum is horizontal. Drag/Resize the crop box to frame the spectrum.
3.  **Process**: Click "Process Frame" (single shot) or "Start Live" (continuous).
4.  **Calibrate**:
    -   *Option A*: Point at a white light, click "Auto Calibrate".
    -   *Option B*: Point at a known laser, enter its wavelength, click "Calibrate".
5.  **Analyze**: View the chart. Toggle "Auto-detect Peaks" to see peak values.
6.  **Save**: Click "Save CSV" to download the data.
