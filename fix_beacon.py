import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

start_str = 'void initBLE() {'
end_str = '  pAdvertising->start();\n}'

start_idx = content.find(start_str)
end_idx = content.find(end_str) + len(end_str)

if start_idx != -1 and content.find(end_str) != -1:
    new_initBLE = '''void initBLE() {
  NimBLEDevice::init("FocusX_Beacon");
  NimBLEAdvertising *pAdvertising = NimBLEDevice::getAdvertising();
  
  NimBLEBeacon beacon;
  beacon.setManufacturerId(0x004C); // Apple Company ID
  beacon.setProximityUUID(NimBLEUUID("87b99b2c-90fd-11e9-bc42-526af7764f64"));
  beacon.setMajor(1);
  beacon.setMinor(1);
  beacon.setSignalPower(0xC5);
  
  NimBLEAdvertisementData oAdvertisementData = NimBLEAdvertisementData();
  oAdvertisementData.setFlags(0x04);
  oAdvertisementData.setManufacturerData(beacon.getData());
  
  pAdvertising->setAdvertisementData(oAdvertisementData);
  pAdvertising->start();
}'''
    content = content[:start_idx] + new_initBLE + content[end_idx:]
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
else:
    print("Could not find initBLE")
