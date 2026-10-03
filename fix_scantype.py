import sys

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\src\app\api\hardware\scan\route.ts'

with open(file_path, 'r') as f:
    content = f.read()

content = content.replace('if (scanType === "QR") {', 'if (scanType.toUpperCase() === "QR") {')
content = content.replace('} else if (scanType === "RFID") {', '} else if (scanType.toUpperCase() === "RFID") {')

with open(file_path, 'w') as f:
    f.write(content)
