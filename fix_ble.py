import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# 1. Update setup() where READER_ID is assigned
old_setup_reader = '''  if (READER_ID == "") {
    READER_ID = WiFi.macAddress();
    READER_ID.replace(":", "");
  }'''

new_setup_reader = '''  if (READER_ID == "") {
    uint8_t mac[6];
    WiFi.macAddress(mac);
    int major = (mac[2] << 8) | mac[3];
    int minor = (mac[4] << 8) | mac[5];
    char beacon_id[64];
    snprintf(beacon_id, sizeof(beacon_id), "87b99b2c-90fd-11e9-bc42-526af7764f64:%d:%d", major, minor);
    READER_ID = String(beacon_id);
  }'''

content = content.replace(old_setup_reader, new_setup_reader)

# 2. Update initBLE() to inject the MAC bytes into the beacon
old_ble = '''  m_beacon_data[20] = 0x00;
  m_beacon_data[21] = 0x01;
  m_beacon_data[22] = 0x00;
  m_beacon_data[23] = 0x01;'''

new_ble = '''  uint8_t mac[6];
  WiFi.macAddress(mac);
  m_beacon_data[20] = mac[2];
  m_beacon_data[21] = mac[3];
  m_beacon_data[22] = mac[4];
  m_beacon_data[23] = mac[5];'''

content = content.replace(old_ble, new_ble)

with open(file_path, 'w') as f:
    f.write(content)
