import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# Remove the line 1 inclusion
content = content.replace('#include <NimBLEDevice.h>\n', '')

# Remove old BLE includes
content = content.replace('#include <BLEDevice.h>\n', '')
content = content.replace('#include <BLEUtils.h>\n', '')
content = content.replace('#include <BLEServer.h>\n', '')
content = content.replace('#include <BLEBeacon.h>\n', '')
content = content.replace('#include <BLEAdvertising.h>\n', '')

# Add NimBLEDevice.h after Wire.h
content = content.replace('#include <Wire.h>\n', '#include <Wire.h>\n#include <NimBLEDevice.h>\n')

with open(file_path, 'w') as f:
    f.write(content)
