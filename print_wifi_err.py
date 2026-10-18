import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

old_wifi_check = '''  AuthResponse res;
  res.resultCode = 3; 

  if (WiFi.status() == WL_CONNECTED) {'''

new_wifi_check = '''  AuthResponse res;
  res.resultCode = 3; 
  strncpy(res.message, "WIFI DISCONNECTED", sizeof(res.message)-1);

  if (WiFi.status() == WL_CONNECTED) {'''

text = text.replace(old_wifi_check, new_wifi_check)

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated wifi disconnected string")
