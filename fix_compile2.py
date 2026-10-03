import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# Remove ALL instances
content = content.replace('volatile bool remoteOpenIn = false;\n', '')
content = content.replace('volatile bool remoteOpenOut = false;\n', '')

# Insert ONCE at the top
content = "volatile bool remoteOpenIn = false;\nvolatile bool remoteOpenOut = false;\n" + content

with open(file_path, 'w') as f:
    f.write(content)
