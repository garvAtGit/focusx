import sys

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# Remove any existing NimBLE inclusions
content = content.replace('#include <NimBLEDevice.h>\n', '')
content = content.replace('#include "NimBLEDevice.h"\n', '')

# Prepend it to the very top
content = "#include <NimBLEDevice.h>\n" + content

with open(file_path, 'w') as f:
    f.write(content)
