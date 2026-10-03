import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

wifi_logic = """
  WiFi.begin("YOUR_SSID", "YOUR_PASSWORD");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
"""
content = re.sub(r'  if \(!wm\.autoConnect\("FocusX Scanner"\)\) \{.*?\n  \}', wifi_logic, content, flags=re.DOTALL)

with open(file_path, 'w') as f:
    f.write(content)
