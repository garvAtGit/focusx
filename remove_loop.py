import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

content = content.replace('for (int i = 0; i < 25; i++) strServiceData += (char)m_beacon_data[i];\n  oAdvertisementData.addData((char*)m_beacon_data, 25);', 'oAdvertisementData.addData((char*)m_beacon_data, 25);')

with open(file_path, 'w') as f:
    f.write(content)
