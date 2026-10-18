import sys

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Restore the correct UUID! NimBLEBeacon doesn't flip it!
content = content.replace(
    'beacon.setProximityUUID(NimBLEUUID("644f76f7-6a52-42bc-e911-fd902c9bb987"));',
    'beacon.setProximityUUID(NimBLEUUID("87b99b2c-90fd-11e9-bc42-526af7764f64"));'
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
