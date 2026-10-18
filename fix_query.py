import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# Change bleReaderId=eq. to macAddress=eq. in all API calls from the ESP32
content = content.replace('bleReaderId=eq.', 'macAddress=eq.')

with open(file_path, 'w') as f:
    f.write(content)
