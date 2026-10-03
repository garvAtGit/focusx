import sys

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Change stack size and core pinning
content = content.replace('xTaskCreatePinnedToCore(httpWorkerTask, "HTTP", 8192, NULL, 1, NULL, 0);', 'xTaskCreatePinnedToCore(httpWorkerTask, "HTTP", 16384, NULL, 1, NULL, 1);')

# Add ESP.getFreeHeap() print so we can see if it's out of memory
content = content.replace('int httpCode = http.POST(requestBody);', '''
            Serial.print("Free Heap before POST: ");
            Serial.println(ESP.getFreeHeap());
            int httpCode = http.POST(requestBody);
            Serial.print("HTTP Code: ");
            Serial.println(httpCode);
''')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
