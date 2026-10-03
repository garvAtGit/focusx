import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# Fix redefinition
content = content.replace('volatile bool remoteOpenIn = false;\nvolatile bool remoteOpenOut = false;', '', 1)

# Fix NimBLE addData
content = content.replace('oAdvertisementData.addData(strServiceData);', 'oAdvertisementData.addData(m_beacon_data, 25);')

with open(file_path, 'w') as f:
    f.write(content)
