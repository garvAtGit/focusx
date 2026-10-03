import os
import re

p = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'
with open(p, 'r') as f:
    c = f.read()

c = re.sub(r'String savedKey = preferences\.getString\("apikey", ""\);.*?if \(savedReader != ""\) READER_ID = savedReader;', '', c, flags=re.DOTALL)

with open(p, 'w') as f:
    f.write(c)
