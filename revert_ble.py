import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# Remove NimBLE includes
content = content.replace('#include <NimBLEDevice.h>\n', '')

# Add standard BLE includes
ble_includes = """#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLEBeacon.h>
#include <BLEAdvertising.h>
"""
content = content.replace('#include <Wire.h>\n', '#include <Wire.h>\n' + ble_includes)

# Replace NimBLE init with standard BLE init
nimble_init = """void initBLE() {
  NimBLEDevice::init("FocusX_Beacon");
  NimBLEAdvertising *pAdvertising = NimBLEDevice::getAdvertising();
  
  NimBLEAdvertisementData oAdvertisementData = NimBLEAdvertisementData();"""

standard_init = """void initBLE() {
  BLEDevice::init("FocusX_Beacon");
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  
  BLEAdvertisementData oAdvertisementData = BLEAdvertisementData();"""

content = content.replace(nimble_init, standard_init)

# Replace addData
# Standard BLE needs std::string
content = content.replace('oAdvertisementData.addData(m_beacon_data, 25);', """  std::string strServiceData = "";
  for (int i = 0; i < 25; i++) strServiceData += (char)m_beacon_data[i];
  oAdvertisementData.addData(strServiceData);""")

with open(file_path, 'w') as f:
    f.write(content)
