import sys

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# Add debug prints to setup()
content = content.replace('initBLE();', 'Serial.println("Calling initBLE()");\n  initBLE();\n  Serial.println("initBLE() done.");')
content = content.replace('nfc1.begin();', 'Serial.println("Calling nfc1.begin()");\n  nfc1.begin();\n  Serial.println("nfc1.begin() done.");')
content = content.replace('nfc2.begin();', 'Serial.println("Calling nfc2.begin()");\n  nfc2.begin();\n  Serial.println("nfc2.begin() done.");')

with open(file_path, 'w') as f:
    f.write(content)
