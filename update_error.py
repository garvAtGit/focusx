import sys

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

content = content.replace('lcd.print("NETWORK ERROR");', 'lcd.print(res.message);')
content = content.replace('http.end();\n          }', '} else {\n              snprintf(res.message, sizeof(res.message)-1, "HTTP %d", httpCode);\n            }\n            http.end();\n          }')

with open(file_path, 'w') as f:
    f.write(content)
