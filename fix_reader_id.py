import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

old_block = '''  // Set Reader ID to MAC Address automatically
  READER_ID = WiFi.macAddress();
  READER_ID.replace(":", "");'''

new_block = '''  // Set Reader ID to MAC Address automatically
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char beacon_id[64];
  snprintf(beacon_id, sizeof(beacon_id), "87b99b2c-90fd-11e9-bc42-526af7764f64:%d:%d", (mac[2]<<8)|mac[3], (mac[4]<<8)|mac[5]);
  READER_ID = String(beacon_id);'''

content = content.replace(old_block, new_block)

# Clean up the preferences.clear() so it doesn't wipe credentials next time
content = content.replace('preferences.clear(); // FORCE WIPE TO TRIGGER NEW BLUETOOTH ID\n', '')

with open(file_path, 'w') as f:
    f.write(content)
