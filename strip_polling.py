import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# I will find the else block and comment it out!
# Looking for `} else {\n        // Idle time: Check for BLE check-ins`
# The easiest way is to use regex or string replacement.

start_str = '      } else {\n        // Idle time: Check for BLE check-ins'

# Let's just rewrite the whole httpWorkerTask again to be completely stripped of idle polling.
start_idx = content.find('void httpWorkerTask(void *pvParameters) {')
end_idx = content.find('void sendHardwarePing() {')

if start_idx != -1 and end_idx != -1:
    new_worker = '''void httpWorkerTask(void *pvParameters) {
    AuthRequest req;
    
    while (true) {
      // Wait infinitely for a scan (portMAX_DELAY) so it never loops pointlessly!
      if (xQueueReceive(authRequestQueue, &req, portMAX_DELAY) == pdPASS) {
        AuthResponse res;
        res.resultCode = 3;
        strncpy(res.message, "SERVER ERROR", sizeof(res.message)-1);
        res.message[sizeof(res.message)-1] = '\\0';
  
        if (WiFi.status() == WL_CONNECTED) {
          WiFiClientSecure client;
          client.setInsecure();
          HTTPClient http;
          
          if (http.begin(client, API_URL)) {
            http.addHeader("Content-Type", "application/json");
            http.addHeader("Authorization", String("Bearer ") + HARDWARE_API_KEY);
            http.setTimeout(5000);
  
            StaticJsonDocument<256> reqDoc;
            reqDoc["eventId"] = req.eventId;
            reqDoc["readerId"] = READER_ID.c_str();
            reqDoc["scanType"] = req.scanType;
            reqDoc["payload"] = req.payload;
            
            String requestBody;
            serializeJson(reqDoc, requestBody);
            
            Serial.print("Free Heap before POST: ");
            Serial.println(ESP.getFreeHeap());
            
            int httpCode = http.POST(requestBody);
            
            Serial.print("HTTP Code: ");
            Serial.println(httpCode);
  
            if (httpCode >= 200 && httpCode < 300) {
              String responseBody = http.getString();
              StaticJsonDocument<512> resDoc;
              DeserializationError err = deserializeJson(resDoc, responseBody);
              if (!err && resDoc.containsKey("status")) {
                String status = resDoc["status"];
                if (status == "APPROVED" || status == "GRANTED" || status == "ALLOW") {
                     res.resultCode = 1;
                     if (resDoc.containsKey("direction")) {
                         const char* dir = resDoc["direction"];
                         strncpy(res.direction, dir, 15);
                         res.direction[15] = '\\0';
                     } else {
                         strcpy(res.direction, "IN");
                     }
                } else {
                   res.resultCode = 2; // Denied
                   if (resDoc.containsKey("message")) {
                       strncpy(res.message, resDoc["message"], 63);
                   } else {
                       strcpy(res.message, "SERVER DENIED");
                   }
                }
              } else {
                  res.resultCode = 2;
                  strcpy(res.message, "JSON PARSE ERR");
              }
            } else {
              res.resultCode = 2; // HTTP Error
              snprintf(res.message, 63, "HTTP ERR: %d", httpCode);
            }
            http.end();
          } else {
            res.resultCode = 2; // HTTP Error
            strcpy(res.message, "HTTP BEGIN FAIL");
          }
        }
        xQueueSend(authResponseQueue, &res, 0);
      }
    }
}

'''
    content = content[:start_idx] + new_worker + content[end_idx:]
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
else:
    print("Failed to find bounds")
