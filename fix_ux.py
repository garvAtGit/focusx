import os
import re

p = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'
with open(p, 'r') as f:
    c = f.read()

# Change the API key variable
c = c.replace('char HARDWARE_API_KEY[64] = "";', 'const char* HARDWARE_API_KEY = "YOUR_API_KEY_HERE";')

# Remove wm.addParameter lines
c = re.sub(r'WiFiManagerParameter custom_api_key.*?wm\.addParameter\(&custom_reader_id\);', '', c, flags=re.DOTALL)

# Remove the preferences saving block for the custom fields
c = re.sub(r'String newKey = custom_api_key.*?preferences\.end\(\);', 'preferences.end();', c, flags=re.DOTALL)

with open(p, 'w') as f:
    f.write(c)
