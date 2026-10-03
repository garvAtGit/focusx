import sys

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

content = content.replace('m_beacon_data[22] = (decimalMac >> 8) & 0xFF;\n  m_beacon_data[23] = decimalMac & 0xFF;', 'm_beacon_data[22] = 0x00;\n  m_beacon_data[23] = 0x01;')

with open(file_path, 'w') as f:
    f.write(content)
