import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# Remove WiFiManager
content = content.replace('#include <WiFiManager.h>\n', '')

# Remove wm.autoConnect
wifi_logic = """
  WiFi.begin("YOUR_SSID", "YOUR_PASSWORD");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
"""
content = re.sub(r'  WiFiManager wm;\n.*?(if \(!wm\.autoConnect\("FocusX_Scanner"\)\) \{).*?\n  \}', wifi_logic, content, flags=re.DOTALL)
content = re.sub(r'  WiFiManagerParameter custom_api_key.*?;', '', content)
content = re.sub(r'  WiFiManagerParameter custom_reader_id.*?;', '', content)
content = re.sub(r'  wm\.addParameter\(&custom_api_key\);', '', content)
content = re.sub(r'  wm\.addParameter\(&custom_reader_id\);', '', content)

with open(file_path, 'w') as f:
    f.write(content)
