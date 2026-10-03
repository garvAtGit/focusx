import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

content = re.sub(r'  WiFiManager wm;\n', '', content)
content = re.sub(r'  wm\.setConnectTimeout\(30\);\n', '', content)
content = re.sub(r'  wm\.setConfigPortalTimeout\(120\);\n', '', content)
content = re.sub(r'  String newKey = custom_api_key\.getValue\(\);\n', '  String newKey = "";\n', content)
content = re.sub(r'  String newReaderId = custom_reader_id\.getValue\(\);\n', '  String newReaderId = "";\n', content)

with open(file_path, 'w') as f:
    f.write(content)
