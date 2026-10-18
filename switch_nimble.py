import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace BLE includes
content = content.replace('#include <BLEDevice.h>', '#include <NimBLEDevice.h>')
content = content.replace('#include <BLEUtils.h>', '#include <NimBLEUtils.h>')
content = content.replace('#include <BLEServer.h>', '#include <NimBLEServer.h>')
content = content.replace('#include <BLEBeacon.h>', '#include <NimBLEBeacon.h>')
content = content.replace('#include <BLEAdvertising.h>', '#include <NimBLEAdvertising.h>')

# Replace BLE classes
content = content.replace('BLEDevice::', 'NimBLEDevice::')
content = content.replace('BLEAdvertising', 'NimBLEAdvertising')
content = content.replace('BLEAdvertisementData', 'NimBLEAdvertisementData')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
