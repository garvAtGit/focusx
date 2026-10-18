import os
import re

p = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'
with open(p, 'r') as f:
    c = f.read()

# Replace esp_gap_ble_api.h with NimBLEDevice.h
c = re.sub(r'#include <esp_gap_ble_api\.h>', r'#include <NimBLEDevice.h>', c)

nimble_init_logic = """
void initBLE() {
  NimBLEDevice::init("FocusX_Beacon");
  NimBLEAdvertising *pAdvertising = NimBLEDevice::getAdvertising();
  
  NimBLEAdvertisementData oAdvertisementData = NimBLEAdvertisementData();
  
  uint8_t m_beacon_data[25];
  // Apple iBeacon manufacturer data (0x004C)
  m_beacon_data[0] = 0x4C;
  m_beacon_data[1] = 0x00;
  m_beacon_data[2] = 0x02;
  m_beacon_data[3] = 0x15; // iBeacon indicator

  // 16 byte UUID: 87b99b2c-90fd-11e9-bc42-526af7764f64
  uint8_t uuid[16] = {0x87, 0xb9, 0x9b, 0x2c, 0x90, 0xfd, 0x11, 0xe9, 0xbc, 0x42, 0x52, 0x6a, 0xf7, 0x76, 0x4f, 0x64};
  memcpy(&m_beacon_data[4], uuid, 16);

  // Major: 1
  m_beacon_data[20] = 0x00;
  m_beacon_data[21] = 0x01;
  
  // Minor: mapped from MAC
  m_beacon_data[22] = (decimalMac >> 8) & 0xFF;
  m_beacon_data[23] = decimalMac & 0xFF;
  
  // Tx Power
  m_beacon_data[24] = 0xC5;

  std::string strServiceData = "";
  for (int i = 0; i < 25; i++) {
    strServiceData += (char)m_beacon_data[i];
  }
  
  oAdvertisementData.addData(strServiceData);
  oAdvertisementData.setFlags(0x04); // BR_EDR_NOT_SUPPORTED
  
  pAdvertising->setAdvertisementData(oAdvertisementData);
  pAdvertising->start();
}
"""

# Replace my_gap_event_handler and initBLE
c = re.sub(r'void my_gap_event_handler.*?void initBLE\(\) \{.*?esp_ble_gap_config_adv_data_raw\(raw_adv_data, sizeof\(raw_adv_data\)\);\n  \}', nimble_init_logic, c, flags=re.DOTALL)

with open(p, 'w') as f:
    f.write(c)
