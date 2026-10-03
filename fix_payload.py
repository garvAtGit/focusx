import sys

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# Replace the payload string
old_payload = 'String payload = "{\\"uid\\":\\"" + r.uid + "\\",\\"isExit\\":" + String(r.isExit?"true":"false") + ",\\"readerId\\":\\"" + READER_ID + "\\"}";'
new_payload = 'String eventId = String(millis());\n          String payload = "{\\"eventId\\":\\"" + eventId + "\\",\\"readerId\\":\\"" + READER_ID + "\\",\\"scanType\\":\\"RFID\\",\\"payload\\":\\"" + r.uid + "\\"}";'

content = content.replace(old_payload, new_payload)

with open(file_path, 'w') as f:
    f.write(content)
