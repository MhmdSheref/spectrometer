document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const csvInput1 = document.getElementById('csvInput1');
    const csvInput2 = document.getElementById('csvInput2');
    const uploadBtn1 = document.getElementById('uploadBtn1');
    const uploadBtn2 = document.getElementById('uploadBtn2');
    const status1 = document.getElementById('status1');
    const status2 = document.getElementById('status2');
    const metricsSection = document.getElementById('metricsSection');
    const metricsBody = document.getElementById('metricsBody');
    const chartHint = document.getElementById('chartHint');
    const comparisonChartCtx = document.getElementById('comparisonChart').getContext('2d');

    // State
    let spectrum1Data = null;
    let spectrum2Data = null;
    let chartInstance = null;

    // Wavelength to Color (same as main app)
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

    // Chart gradient
    function updateChartGradient(chart) {
        const ctx = chart.ctx;
        const chartArea = chart.chartArea;
        if (!chartArea) return null;
        const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
        const xScale = chart.scales.x;
        const minNm = xScale.min || 300;
        const maxNm = xScale.max || 800;
        for (let nm = minNm; nm <= maxNm; nm += 10) {
            const pos = (nm - minNm) / (maxNm - minNm);
            if (pos >= 0 && pos <= 1) gradient.addColorStop(pos, wavelengthToColor(nm));
        }
        return gradient;
    }

    // Initialize Chart
    function initChart() {
        chartInstance = new Chart(comparisonChartCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: 'Wavelength (nm)', color: '#888' },
                        grid: { color: '#333' },
                        ticks: { color: '#888' },
                        min: 300,
                        max: 800
                    },
                    y: {
                        title: { display: true, text: 'Normalized Intensity', color: '#888' },
                        grid: { color: '#333' },
                        ticks: { color: '#888' }
                    }
                },
                plugins: {
                    legend: { labels: { color: '#e0e0e0' } }
                }
            }
        });
    }
    initChart();

    // Parse CSV
    function parseCSV(text) {
        const lines = text.trim().split('\n');
        if (lines.length < 2) {
            throw new Error('CSV file is empty or invalid');
        }

        // Skip header line
        const dataLines = lines.slice(1);

        const wavelengths = [];
        const intensity = [];
        const red = [];
        const green = [];
        const blue = [];

        dataLines.forEach(line => {
            const values = line.split(',').map(v => parseFloat(v.trim()));
            if (values.length >= 5 && !values.some(isNaN)) {
                wavelengths.push(values[0]);
                intensity.push(values[1]);
                red.push(values[2]);
                green.push(values[3]);
                blue.push(values[4]);
            }
        });

        if (wavelengths.length === 0) {
            throw new Error('No valid data found in CSV');
        }

        return { wavelengths, intensity, red, green, blue };
    }

    // Find peaks
    function findPeaks(data) {
        const peaks = {
            red: { index: -1, wavelength: 0, intensity: 0 },
            green: { index: -1, wavelength: 0, intensity: 0 },
            blue: { index: -1, wavelength: 0, intensity: 0 },
            total: { index: -1, wavelength: 0, intensity: 0 }
        };

        // Find peak for each channel
        ['red', 'green', 'blue', 'intensity'].forEach(channel => {
            const arr = channel === 'intensity' ? data.intensity : data[channel];
            let maxVal = -1;
            let maxIdx = -1;

            arr.forEach((val, idx) => {
                if (val > maxVal) {
                    maxVal = val;
                    maxIdx = idx;
                }
            });

            const peakKey = channel === 'intensity' ? 'total' : channel;
            if (maxVal > 0.1) { // Threshold to ignore noise
                peaks[peakKey] = {
                    index: maxIdx,
                    wavelength: data.wavelengths[maxIdx],
                    intensity: maxVal
                };
            }
        });

        return peaks;
    }


    // Update chart with both spectra
    function updateChart() {
        if (!spectrum1Data && !spectrum2Data) return;

        const datasets = [];

        // Calculate dynamic x-axis range from actual data
        let minWavelength = 300;
        let maxWavelength = 800;

        if (spectrum1Data || spectrum2Data) {
            const allWavelengths = [];
            if (spectrum1Data) allWavelengths.push(...spectrum1Data.wavelengths);
            if (spectrum2Data) allWavelengths.push(...spectrum2Data.wavelengths);

            if (allWavelengths.length > 0) {
                minWavelength = Math.min(...allWavelengths);
                maxWavelength = Math.max(...allWavelengths);
            }
        }

        if (spectrum1Data) {
            // Spectrum 1 - Red, Green, Blue channels
            datasets.push({
                label: 'Spectrum 1 - Red',
                data: spectrum1Data.wavelengths.map((wl, i) => ({ x: wl, y: spectrum1Data.red[i] })),
                borderColor: 'rgba(255, 99, 132, 0.8)',
                borderWidth: 2,
                pointRadius: 0,
                fill: false,
                order: 2
            });

            datasets.push({
                label: 'Spectrum 1 - Green',
                data: spectrum1Data.wavelengths.map((wl, i) => ({ x: wl, y: spectrum1Data.green[i] })),
                borderColor: 'rgba(75, 192, 192, 0.8)',
                borderWidth: 2,
                pointRadius: 0,
                fill: false,
                order: 3
            });

            datasets.push({
                label: 'Spectrum 1 - Blue',
                data: spectrum1Data.wavelengths.map((wl, i) => ({ x: wl, y: spectrum1Data.blue[i] })),
                borderColor: 'rgba(54, 162, 235, 0.8)',
                borderWidth: 2,
                pointRadius: 0,
                fill: false,
                order: 4
            });
        }

        if (spectrum2Data) {
            // Spectrum 2 - Red, Green, Blue channels (with dashed lines for distinction)
            datasets.push({
                label: 'Spectrum 2 - Red',
                data: spectrum2Data.wavelengths.map((wl, i) => ({ x: wl, y: spectrum2Data.red[i] })),
                borderColor: 'rgba(255, 99, 132, 0.5)',
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false,
                order: 2
            });

            datasets.push({
                label: 'Spectrum 2 - Green',
                data: spectrum2Data.wavelengths.map((wl, i) => ({ x: wl, y: spectrum2Data.green[i] })),
                borderColor: 'rgba(75, 192, 192, 0.5)',
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false,
                order: 3
            });

            datasets.push({
                label: 'Spectrum 2 - Blue',
                data: spectrum2Data.wavelengths.map((wl, i) => ({ x: wl, y: spectrum2Data.blue[i] })),
                borderColor: 'rgba(54, 162, 235, 0.5)',
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false,
                order: 4
            });
        }

        chartInstance.data.datasets = datasets;

        // Update x-axis range dynamically
        chartInstance.options.scales.x.min = minWavelength;
        chartInstance.options.scales.x.max = maxWavelength;

        chartInstance.update();

        if (spectrum1Data && spectrum2Data) {
            chartHint.textContent = 'Both spectra loaded and displayed. Spectrum 1 (solid lines), Spectrum 2 (dashed lines).';
        } else {
            chartHint.textContent = 'Upload both CSV files to see the comparison.';
        }
    }

    // Update metrics table
    function updateMetrics() {
        if (!spectrum1Data || !spectrum2Data) {
            metricsSection.style.display = 'none';
            return;
        }

        const peaks1 = findPeaks(spectrum1Data);
        const peaks2 = findPeaks(spectrum2Data);

        metricsBody.innerHTML = '';

        // Red channel peak
        if (peaks1.red.index !== -1 && peaks2.red.index !== -1) {
            const redWlDiff = Math.abs(peaks1.red.wavelength - peaks2.red.wavelength).toFixed(2);
            metricsBody.innerHTML += `
                <tr>
                    <td><strong>Red Peak (nm)</strong></td>
                    <td>${peaks1.red.wavelength.toFixed(2)}</td>
                    <td>${peaks2.red.wavelength.toFixed(2)}</td>
                    <td>${redWlDiff} nm</td>
                </tr>
            `;
        }

        // Green channel peak
        if (peaks1.green.index !== -1 && peaks2.green.index !== -1) {
            const greenWlDiff = Math.abs(peaks1.green.wavelength - peaks2.green.wavelength).toFixed(2);
            metricsBody.innerHTML += `
                <tr>
                    <td><strong>Green Peak (nm)</strong></td>
                    <td>${peaks1.green.wavelength.toFixed(2)}</td>
                    <td>${peaks2.green.wavelength.toFixed(2)}</td>
                    <td>${greenWlDiff} nm</td>
                </tr>
            `;
        }

        // Blue channel peak
        if (peaks1.blue.index !== -1 && peaks2.blue.index !== -1) {
            const blueWlDiff = Math.abs(peaks1.blue.wavelength - peaks2.blue.wavelength).toFixed(2);
            metricsBody.innerHTML += `
                <tr>
                    <td><strong>Blue Peak (nm)</strong></td>
                    <td>${peaks1.blue.wavelength.toFixed(2)}</td>
                    <td>${peaks2.blue.wavelength.toFixed(2)}</td>
                    <td>${blueWlDiff} nm</td>
                </tr>
            `;
        }

        metricsSection.style.display = 'block';
    }

    // File upload handlers
    uploadBtn1.addEventListener('click', () => csvInput1.click());
    uploadBtn2.addEventListener('click', () => csvInput2.click());

    csvInput1.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                spectrum1Data = parseCSV(e.target.result);
                status1.textContent = `✓ ${file.name} loaded (${spectrum1Data.wavelengths.length} data points)`;
                status1.style.color = '#4caf50';
                updateChart();
                updateMetrics();
            } catch (err) {
                status1.textContent = `✗ Error: ${err.message}`;
                status1.style.color = '#f44336';
                spectrum1Data = null;
            }
        };
        reader.readAsText(file);
    });

    csvInput2.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                spectrum2Data = parseCSV(e.target.result);
                status2.textContent = `✓ ${file.name} loaded (${spectrum2Data.wavelengths.length} data points)`;
                status2.style.color = '#4caf50';
                updateChart();
                updateMetrics();
            } catch (err) {
                status2.textContent = `✗ Error: ${err.message}`;
                status2.style.color = '#f44336';
                spectrum2Data = null;
            }
        };
        reader.readAsText(file);
    });
});
