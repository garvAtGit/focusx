import sys

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

old_prefs = '''  preferences.begin("focusx", false);
  String stored_key = preferences.getString("API_KEY", "");
  String stored_reader = preferences.getString("READER_ID", "");'''

new_prefs = '''  preferences.begin("focusx", false);
  preferences.clear(); // FORCE WIPE TO TRIGGER NEW BLUETOOTH ID
  String stored_key = preferences.getString("API_KEY", "");
  String stored_reader = preferences.getString("READER_ID", "");'''

content = content.replace(old_prefs, new_prefs)

with open(file_path, 'w') as f:
    f.write(content)
