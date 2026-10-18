import sys

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

start_str = 'void initBLE() {'
end_str = '  pAdvertising->start();\n}'

start_idx = content.find(start_str)
end_idx = content.find(end_str) + len(end_str)

if start_idx != -1 and end_idx != -1:
    new_initBLE = '''void initBLE() {
  NimBLEDevice::init("FocusX_Beacon");
  NimBLEAdvertising *pAdvertising = NimBLEDevice::getAdvertising();
  
  uint8_t payload[25];
  payload[0] = 0x4C; // Apple LSB
  payload[1] = 0x00; // Apple MSB
  payload[2] = 0x02; // iBeacon Type
  payload[3] = 0x15; // Length
  uint8_t uuid[16] = {0x87, 0xb9, 0x9b, 0x2c, 0x90, 0xfd, 0x11, 0xe9, 0xbc, 0x42, 0x52, 0x6a, 0xf7, 0x76, 0x4f, 0x64};
  memcpy(&payload[4], uuid, 16);
  payload[20] = 0x00; // Major MSB
  payload[21] = 0x01; // Major LSB
  payload[22] = 0x00; // Minor MSB
  payload[23] = 0x01; // Minor LSB
  payload[24] = 0xC5; // TX Power
  
  NimBLEAdvertisementData oAdvertisementData = NimBLEAdvertisementData();
  oAdvertisementData.setFlags(0x04);
  oAdvertisementData.setManufacturerData(std::string((char*)payload, 25));
  
  pAdvertising->setAdvertisementData(oAdvertisementData);
  pAdvertising->start();
}'''
    content = content[:start_idx] + new_initBLE + content[end_idx:]
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
else:
    print("Could not find initBLE")
