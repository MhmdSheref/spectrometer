document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const imageInput = document.getElementById('imageInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const cameraBtn = document.getElementById('cameraBtn');

    const previewWrapper = document.getElementById('previewWrapper');
    const videoFeed = document.getElementById('videoFeed');
    const imagePreview = document.getElementById('imagePreview');
    const cropOverlay = document.getElementById('cropOverlay');
    const cropBox = document.getElementById('cropBox');
    const placeholderText = document.getElementById('placeholderText');

    const rotationSlider = document.getElementById('rotationSlider');
    const rotationVal = document.getElementById('rotationVal');
    const resetCropBtn = document.getElementById('resetCrop');

    const processBtn = document.getElementById('processBtn');
    const startLiveBtn = document.getElementById('startLiveBtn');
    const stopLiveBtn = document.getElementById('stopLiveBtn');

    const spectrumChartCtx = document.getElementById('spectrumChart').getContext('2d');
    const calibLaserNmInput = document.getElementById('calib_laser_nm');
    const calibrateBtn = document.getElementById('calibrateBtn');
    const autoPeaksToggle = document.getElementById('autoPeaksToggle');
    const saveCsvBtn = document.getElementById('saveCsvBtn');

    // State
    let chartInstance = null;
    let currentData = null;
    let nmPerPixel = (750 - 380) / 1000;
    let wavelengthOffset = 0;
    let liveInterval = null;
    let isCameraMode = false;
    let rotation = 0;

    let cropState = {
        x: 50, y: 50, width: 200, height: 100,
        isDragging: false, isResizing: false,
        resizeHandle: null, startX: 0, startY: 0
    };

    // Wavelength to Color
    function wavelengthToColor(wavelength) {
        let R, G, B, alpha;
        if (wavelength >= 380 && wavelength < 440) {
            R = -1 * (wavelength - 440) / (440 - 380); G = 0; B = 1;
        } else if (wavelength >= 440 && wavelength < 490) {
            R = 0; G = (wavelength - 440) / (490 - 440); B = 1;
        } else if (wavelength >= 490 && wavelength < 510) {
            R = 0; G = 1; B = -1 * (wavelength - 510) / (510 - 490);
        } else if (wavelength >= 510 && wavelength < 580) {
            R = (wavelength - 510) / (580 - 510); G = 1; B = 0;
        } else if (wavelength >= 580 && wavelength < 645) {
            R = 1; G = -1 * (wavelength - 645) / (645 - 580); B = 0;
        } else if (wavelength >= 645 && wavelength <= 781) {
            R = 1; G = 0; B = 0;
        } else {
            R = 0; G = 0; B = 0;
        }

        if (wavelength >= 380 && wavelength < 420) alpha = 0.3 + 0.7 * (wavelength - 380) / (420 - 380);
        else if (wavelength >= 420 && wavelength < 701) alpha = 1.0;
        else if (wavelength >= 701 && wavelength < 781) alpha = 0.3 + 0.7 * (780 - wavelength) / (780 - 700);
        else alpha = 0.0;

        return `rgba(${R * 255},${G * 255},${B * 255},${alpha})`;
    }

    // Chart Setup
    function updateChartGradient(chart) {
        const ctx = chart.ctx;
        const chartArea = chart.chartArea;
        if (!chartArea) return null;
        const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
        const xScale = chart.scales.x;
        const minNm = xScale.min || 380;
        const maxNm = xScale.max || 750;
        for (let nm = minNm; nm <= maxNm; nm += 10) {
            const pos = (nm - minNm) / (maxNm - minNm);
            if (pos >= 0 && pos <= 1) gradient.addColorStop(pos, wavelengthToColor(nm));
        }
        return gradient;
    }

    function initChart() {
        chartInstance = new Chart(spectrumChartCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Total Intensity',
                        data: [],
                        borderColor: function (context) { return updateChartGradient(context.chart); },
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: true,
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        order: 1
                    },
                    { label: 'Red', data: [], borderColor: 'rgba(255, 99, 132, 0.8)', borderWidth: 1, pointRadius: 0, hidden: false, order: 2 },
                    { label: 'Green', data: [], borderColor: 'rgba(75, 192, 192, 0.8)', borderWidth: 1, pointRadius: 0, hidden: false, order: 3 },
                    { label: 'Blue', data: [], borderColor: 'rgba(54, 162, 235, 0.8)', borderWidth: 1, pointRadius: 0, hidden: false, order: 4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { title: { display: true, text: 'Wavelength (nm)', color: '#888' }, grid: { color: '#333' }, ticks: { color: '#888' } },
                    y: { title: { display: true, text: 'Normalized Intensity', color: '#888' }, grid: { color: '#333' }, ticks: { color: '#888' } }
                },
                plugins: { legend: { labels: { color: '#e0e0e0' } } }
            }
        });
    }
    initChart();

    // Crop Box
    function updateCropBox() {
        cropBox.style.left = cropState.x + 'px';
        cropBox.style.top = cropState.y + 'px';
        cropBox.style.width = cropState.width + 'px';
        cropBox.style.height = cropState.height + 'px';
    }

    function resetCrop() {
        const rect = previewWrapper.getBoundingClientRect();
        cropState.x = 50;
        cropState.y = 50;
        cropState.width = Math.min(300, rect.width - 100);
        cropState.height = Math.min(150, rect.height - 100);
        updateCropBox();
    }

    // Crop Interaction
    cropBox.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.target.classList.contains('crop-handle')) {
            cropState.isResizing = true;
            cropState.resizeHandle = e.target.className.split(' ')[1];
        } else {
            cropState.isDragging = true;
        }
        cropState.startX = e.clientX;
        cropState.startY = e.clientY;
    });

    document.addEventListener('mousemove', (e) => {
        if (!cropState.isDragging && !cropState.isResizing) return;

        const dx = e.clientX - cropState.startX;
        const dy = e.clientY - cropState.startY;

        if (cropState.isDragging) {
            cropState.x += dx;
            cropState.y += dy;
        } else if (cropState.isResizing) {
            const handle = cropState.resizeHandle;
            if (handle === 'ne' || handle === 'se') cropState.width += dx;
            if (handle === 'nw' || handle === 'sw') { cropState.x += dx; cropState.width -= dx; }
            if (handle === 'sw' || handle === 'se') cropState.height += dy;
            if (handle === 'nw' || handle === 'ne') { cropState.y += dy; cropState.height -= dy; }
        }

        cropState.startX = e.clientX;
        cropState.startY = e.clientY;
        updateCropBox();
    });

    document.addEventListener('mouseup', () => {
        cropState.isDragging = false;
        cropState.isResizing = false;
    });

    // Image Upload
    uploadBtn.addEventListener('click', () => imageInput.click());

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        stopLive();
        isCameraMode = false;

        if (videoFeed.srcObject) {
            videoFeed.srcObject.getTracks().forEach(track => track.stop());
            videoFeed.srcObject = null;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            imagePreview.style.display = 'block';
            videoFeed.style.display = 'none';
            placeholderText.style.display = 'none';
            cropOverlay.classList.add('active');

            rotation = 0;
            rotationSlider.value = 0;
            rotationVal.textContent = '0°';
            imagePreview.style.transform = 'rotate(0deg)';

            processBtn.disabled = false;
            startLiveBtn.disabled = false;

            resetCrop();
        };
        reader.readAsDataURL(file);
    });

    // Camera
    cameraBtn.addEventListener('click', async () => {
        try {
            stopLive();
            isCameraMode = true;

            if (videoFeed.srcObject) {
                videoFeed.srcObject.getTracks().forEach(track => track.stop());
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            });

            videoFeed.srcObject = stream;
            videoFeed.style.display = 'block';
            imagePreview.style.display = 'none';
            placeholderText.style.display = 'none';
            cropOverlay.classList.add('active');

            rotation = 0;
            rotationSlider.value = 0;
            rotationVal.textContent = '0°';
            videoFeed.style.transform = 'rotate(0deg)';

            processBtn.disabled = false;
            startLiveBtn.disabled = false;

            resetCrop();

        } catch (err) {
            alert("Could not access camera: " + err.message);
        }
    });

    // Rotation Control - LIVE PREVIEW
    rotationSlider.addEventListener('input', (e) => {
        rotation = parseFloat(e.target.value);
        rotationVal.textContent = rotation + '°';

        // Apply rotation to preview
        if (isCameraMode) {
            videoFeed.style.transform = `rotate(${rotation}deg)`;
        } else {
            imagePreview.style.transform = `rotate(${rotation}deg)`;
        }
    });

    resetCropBtn.addEventListener('click', resetCrop);

    // Processing
    async function processFrame(base64Image) {
        try {
            const res = await fetch('/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64Image })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            currentData = data;
            applyCalibration();

            // AUTO-DETECT PEAKS if toggle is enabled
            if (autoPeaksToggle.checked) {
                await detectPeaks();
            }
        } catch (err) {
            console.error(err);
        }
    }

    function getCroppedData() {
        const sourceElement = isCameraMode ? videoFeed : imagePreview;
        if (!sourceElement || (isCameraMode && videoFeed.readyState < 2)) return null;

        const sourceRect = sourceElement.getBoundingClientRect();
        const wrapperRect = previewWrapper.getBoundingClientRect();

        const sourceWidth = isCameraMode ? videoFeed.videoWidth : imagePreview.naturalWidth;
        const sourceHeight = isCameraMode ? videoFeed.videoHeight : imagePreview.naturalHeight;

        const scaleX = sourceWidth / sourceRect.width;
        const scaleY = sourceHeight / sourceRect.height;

        const cropX = (cropState.x - (sourceRect.left - wrapperRect.left)) * scaleX;
        const cropY = (cropState.y - (sourceRect.top - wrapperRect.top)) * scaleY;
        const cropW = cropState.width * scaleX;
        const cropH = cropState.height * scaleY;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Auto-rotate if crop is vertical
        const shouldRotate = cropH > cropW;
        const finalRotation = rotation + (shouldRotate ? 90 : 0);

        if (finalRotation % 360 === 0) {
            canvas.width = cropW;
            canvas.height = cropH;
            ctx.drawImage(sourceElement, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        } else {
            const rad = finalRotation * Math.PI / 180;
            const sin = Math.abs(Math.sin(rad));
            const cos = Math.abs(Math.cos(rad));

            canvas.width = cropW * cos + cropH * sin;
            canvas.height = cropW * sin + cropH * cos;

            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(rad);

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = cropW;
            tempCanvas.height = cropH;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(sourceElement, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

            ctx.drawImage(tempCanvas, -cropW / 2, -cropH / 2);
            ctx.restore();
        }

        return canvas.toDataURL('image/jpeg');
    }

    processBtn.addEventListener('click', () => {
        const data = getCroppedData();
        if (data) processFrame(data);
    });

    // Live Mode
    startLiveBtn.addEventListener('click', () => {
        startLiveBtn.style.display = 'none';
        stopLiveBtn.style.display = 'inline-block';

        liveInterval = setInterval(() => {
            const data = getCroppedData();
            if (data) processFrame(data);
        }, 500);
    });

    function stopLive() {
        clearInterval(liveInterval);
        startLiveBtn.style.display = 'inline-block';
        stopLiveBtn.style.display = 'none';
    }
    stopLiveBtn.addEventListener('click', stopLive);

    // Calibration
    function applyCalibration() {
        if (!currentData) return;
        const numPixels = currentData.intensity.length;
        const pixels = Array.from({ length: numPixels }, (_, i) => i);
        const wavelengths = pixels.map(p => (p * nmPerPixel) + wavelengthOffset + 380);
        currentData.wavelengths = wavelengths;
        updateChart(wavelengths, currentData);
    }

    function updateChart(labels, data) {
        chartInstance.data.labels = labels.map(l => Math.round(l));
        chartInstance.data.datasets[0].data = data.intensity;
        if (data.red) chartInstance.data.datasets[1].data = data.red;
        if (data.green) chartInstance.data.datasets[2].data = data.green;
        if (data.blue) chartInstance.data.datasets[3].data = data.blue;

        if (chartInstance.data.datasets.length > 4) chartInstance.data.datasets.splice(4);
        chartInstance.update();
    }

    calibrateBtn.addEventListener('click', () => {
        if (!currentData) {
            alert("Please process a spectrum first (or start Live Mode).");
            return;
        }
        const laserNm = parseFloat(calibLaserNmInput.value);
        if (isNaN(laserNm)) {
            alert("Please enter a valid laser wavelength.");
            return;
        }

        let maxInt = -1;
        let maxIdx = -1;
        for (let i = 0; i < currentData.intensity.length; i++) {
            if (currentData.intensity[i] > maxInt) {
                maxInt = currentData.intensity[i];
                maxIdx = i;
            }
        }

        nmPerPixel = (750 - 380) / currentData.intensity.length;
        wavelengthOffset = laserNm - 380 - (maxIdx * nmPerPixel);

        applyCalibration();
        alert(`Calibrated! Peak at pixel ${maxIdx} set to ${laserNm}nm.`);
    });

    // Peak Detection Function
    async function detectPeaks() {
        if (!currentData) return;
        try {
            const res = await fetch('/peaks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wavelengths: currentData.wavelengths,
                    red: currentData.red,
                    green: currentData.green,
                    blue: currentData.blue
                })
            });
            const data = await res.json();
            if (data.peaks) {
                const peakPoints = currentData.intensity.map(() => null);
                ['red', 'green', 'blue'].forEach(channel => {
                    if (data.peaks[channel]) {
                        const p = data.peaks[channel];
                        peakPoints[p.index] = p.intensity;
                    }
                });

                const peakDataset = {
                    label: 'Global Peaks',
                    data: peakPoints,
                    type: 'scatter',
                    backgroundColor: 'white',
                    pointRadius: 8,
                    pointHoverRadius: 10,
                    order: 0
                };

                if (chartInstance.data.datasets.length > 4) chartInstance.data.datasets[4] = peakDataset;
                else chartInstance.data.datasets.push(peakDataset);
                chartInstance.update();
            }
        } catch (err) {
            console.error(err);
        }
    }

    saveCsvBtn.addEventListener('click', () => {
        if (!currentData) return;
        let csvContent = "data:text/csv;charset=utf-8,Wavelength (nm),Intensity,Red,Green,Blue\n";
        currentData.wavelengths.forEach((wl, i) => {
            csvContent += `${wl},${currentData.intensity[i]},${currentData.red[i]},${currentData.green[i]},${currentData.blue[i]}\n`;
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "spectrum_data.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
});
