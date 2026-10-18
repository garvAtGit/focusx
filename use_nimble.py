import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

content = content.replace('#include <BLEDevice.h>', '#include <NimBLEDevice.h>')
content = content.replace('#include <BLEUtils.h>', '#include <NimBLEUtils.h>')
content = content.replace('#include <BLEServer.h>', '#include <NimBLEServer.h>')
content = content.replace('BLEDevice::', 'NimBLEDevice::')
content = content.replace('BLEUUID', 'NimBLEUUID')
content = content.replace('BLEAdvertisementData', 'NimBLEAdvertisementData')
content = content.replace('BLEAdvertising', 'NimBLEAdvertising')
content = content.replace('BLEServer', 'NimBLEServer')
content = content.replace('BLEService', 'NimBLEService')
content = content.replace('BLECharacteristic', 'NimBLECharacteristic')

with open(file_path, 'w') as f:
    f.write(content)
