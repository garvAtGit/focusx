import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# Fix NimNimBLE
content = content.replace('NimNimBLE', 'NimBLE')

# Fix BLEBeacon.h
content = content.replace('<BLEBeacon.h>', '<NimBLEBeacon.h>')
content = content.replace('BLEBeacon', 'NimBLEBeacon')

# Fix other missing replacements
content = content.replace('NimBLEDevice::', 'NimBLEDevice::')
content = content.replace('BLEUUID', 'NimBLEUUID')
content = content.replace('BLEAdvertisementData', 'NimBLEAdvertisementData')
content = content.replace('BLEAdvertising', 'NimBLEAdvertising')
content = content.replace('BLEServer', 'NimBLEServer')
content = content.replace('BLEService', 'NimBLEService')
content = content.replace('BLECharacteristic', 'NimBLECharacteristic')
content = content.replace('BLECharacteristicCallbacks', 'NimBLECharacteristicCallbacks')

with open(file_path, 'w') as f:
    f.write(content)
