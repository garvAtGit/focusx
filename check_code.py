import sys

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# Let's make sure it has the correct standard BLE implementation.
# Check if BLEDevice.h is included.
if '#include <BLEDevice.h>' not in content:
    print("BLEDevice.h missing")
else:
    print("BLEDevice.h present")

# Check if the polling is inside httpWorkerTask
if 'http.PATCH' not in content:
    print("Polling missing")
else:
    print("Polling present")
