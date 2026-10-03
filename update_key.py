import os
import re

p = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'
with open(p, 'r') as f:
    c = f.read()

# Replace the fake API key with the real one
c = c.replace('"YOUR_API_KEY_HERE"', '"my_secret_library_door_key_123"')

with open(p, 'w') as f:
    f.write(c)
