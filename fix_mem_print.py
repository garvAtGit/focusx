import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('Serial.println(ESP.getFreeHeap());', 'Serial.println(ESP.getFreeHeap()); Serial.print("Max Alloc Heap: "); Serial.println(ESP.getMaxAllocHeap());')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
