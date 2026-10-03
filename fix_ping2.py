import sys

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('http.begin(client, url);', 'WiFiClientSecure client; client.setInsecure(); http.begin(client, url);')
# Deduplicate just in case
content = content.replace('WiFiClientSecure client; client.setInsecure(); WiFiClientSecure client; client.setInsecure(); http.begin(client, url);', 'WiFiClientSecure client; client.setInsecure(); http.begin(client, url);')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
