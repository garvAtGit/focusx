import sys

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# Add Serial debugging to HTTP worker
debug_code = """
            String requestBody;
            serializeJson(reqDoc, requestBody);
            
            Serial.println(">>> SENDING HARDWARE SCAN:");
            Serial.println(requestBody);
            
            int httpCode = http.POST(requestBody);
            Serial.println("<<< HTTP CODE: " + String(httpCode));
            
            if (httpCode >= 200 && httpCode < 300) {
              String responseBody = http.getString();
              Serial.println("<<< HTTP RESPONSE: " + responseBody);
"""
content = content.replace('''
            String requestBody;
            serializeJson(reqDoc, requestBody);
            int httpCode = http.POST(requestBody);
  
            if (httpCode >= 200 && httpCode < 300) {
              String responseBody = http.getString();
''', debug_code)

with open(file_path, 'w') as f:
    f.write(content)
