import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

content = re.sub(r'std::string strServiceData = "";\s*for \(int i = 0; i < 25; i\+\+\) strServiceData \+= \(char\)m_beacon_data\[i\];\s*', '', content)

with open(file_path, 'w') as f:
    f.write(content)
