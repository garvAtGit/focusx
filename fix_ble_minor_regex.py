import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

content = re.sub(r'm_beacon_data\[22\] = \(decimalMac >> 8\) & 0xFF;\s*m_beacon_data\[23\] = decimalMac & 0xFF;', 'm_beacon_data[22] = 0x00;\n  m_beacon_data[23] = 0x01;', content)

with open(file_path, 'w') as f:
    f.write(content)
