import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# Swap the SS pins
content = re.sub(r'#define PN532_SS_1 4', '#define PN532_SS_1_TEMP 17', content)
content = re.sub(r'#define PN532_SS_2 17', '#define PN532_SS_2 4', content)
content = re.sub(r'#define PN532_SS_1_TEMP 17', '#define PN532_SS_1 17', content)

with open(file_path, 'w') as f:
    f.write(content)
