import sys

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

content = content.replace('if (status == "APPROVED" || status == "GRANTED") {', 'if (status == "APPROVED" || status == "GRANTED" || status == "ALLOW") {')

with open(file_path, 'w') as f:
    f.write(content)
