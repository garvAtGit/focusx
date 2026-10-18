import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# 1. Revert initBLE to broadcast 1:1
old_ble = '''  uint8_t mac[6];
  WiFi.macAddress(mac);
  m_beacon_data[20] = mac[2];
  m_beacon_data[21] = mac[3];
  m_beacon_data[22] = mac[4];
  m_beacon_data[23] = mac[5];'''

new_ble = '''  m_beacon_data[20] = 0x00;
  m_beacon_data[21] = 0x01;
  m_beacon_data[22] = 0x00;
  m_beacon_data[23] = 0x01;'''

content = content.replace(old_ble, new_ble)

# 2. Revert READER_ID to match the 1:1 payload
old_reader = '''  // Set Reader ID to MAC Address automatically
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char beacon_id[64];
  snprintf(beacon_id, sizeof(beacon_id), "87b99b2c-90fd-11e9-bc42-526af7764f64:%d:%d", (mac[2]<<8)|mac[3], (mac[4]<<8)|mac[5]);
  READER_ID = String(beacon_id);'''

new_reader = '''  // Set Reader ID to strictly match the mobile app's hardcoded POC
  READER_ID = "87b99b2c-90fd-11e9-bc42-526af7764f64:1:1";'''

content = content.replace(old_reader, new_reader)

with open(file_path, 'w') as f:
    f.write(content)
