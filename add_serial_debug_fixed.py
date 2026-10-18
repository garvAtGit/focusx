import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# Add Serial output when doing doAuth
content = content.replace('void doAuth(String uid, bool isExit) {', 'void doAuth(String uid, bool isExit) {\n  Serial.println(">>> doAuth called! UID: " + uid);')

content = content.replace('int httpCode = http.POST(requestBody);', 'Serial.println(">>> Sending to API: " + requestBody);\n  int httpCode = http.POST(requestBody);\n  Serial.println("<<< API Code: " + String(httpCode));')

with open(file_path, 'w') as f:
    f.write(content)
