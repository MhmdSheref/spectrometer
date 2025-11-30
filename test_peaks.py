import numpy as np
from main import detect_peaks_in_data

def test_peaks():
    wavelengths = np.linspace(400, 700, 300).tolist()
    
    # Create synthetic data with peaks
    red = np.zeros(300)
    red[200] = 1.0 # Peak at index 200 (~600nm)
    
    green = np.zeros(300)
    green[100] = 0.8 # Peak at index 100 (~500nm)
    
    blue = np.zeros(300)
    blue[50] = 0.9 # Peak at index 50 (~450nm)
    
    data = {
        'red': red.tolist(),
        'green': green.tolist(),
        'blue': blue.tolist()
    }
    
    peaks = detect_peaks_in_data(wavelengths, data)
    
    print("Peaks detected:", peaks)
    
    assert 'red' in peaks
    assert peaks['red']['index'] == 200
    assert peaks['red']['intensity'] == 1.0
    
    assert 'green' in peaks
    assert peaks['green']['index'] == 100
    
    assert 'blue' in peaks
    assert peaks['blue']['index'] == 50
    
    print("Test Passed!")

if __name__ == "__main__":
    test_peaks()
