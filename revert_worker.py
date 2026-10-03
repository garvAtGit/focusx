import sys

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# I will rewrite the entire httpWorkerTask to the MOST basic, stable, non-persistent, locally-scoped HTTP connection.
start_str = 'void httpWorkerTask(void *pvParameters) {'
end_str = 'void sendHardwarePing() {'

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_worker = '''void httpWorkerTask(void *pvParameters) {
    AuthRequest req;
    
    while (true) {
      if (xQueueReceive(authRequestQueue, &req, pdMS_TO_TICKS(1000)) == pdPASS) {
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
            int httpCode = http.POST(requestBody);
  
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
      } else {
        // Idle time: Check for BLE check-ins (Remote Open commands)
        // INCREASED POLLING INTERVAL TO 10 SECONDS TO PREVENT SOCKET EXHAUSTION!
        if (WiFi.status() == WL_CONNECTED && String(READER_ID) != "" && (millis() - lastBLEPollTime > 10000)) {
          lastBLEPollTime = millis();
          String url = String(SUPABASE_URL) + "/rest/v1/Relay?bleReaderId=eq." + String(READER_ID) + "&select=pendingCommand";
          
          WiFiClientSecure client;
          client.setInsecure();
          HTTPClient http;
          
          if (http.begin(client, url)) {
            http.addHeader("apikey", SUPABASE_ANON_KEY);
            http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
            http.setTimeout(4000);
            int code = http.GET();
            if (code >= 200 && code < 300) {
              String body = http.getString();
              StaticJsonDocument<256> doc;
              DeserializationError err = deserializeJson(doc, body);
              if (!err && doc.is<JsonArray>() && doc.size() > 0) {
                String cmd = doc[0]["pendingCommand"] | "";
                if (cmd == "open_in" || cmd == "OPEN_IN") {
                  remoteOpenIn = true;
                } else if (cmd == "open_out" || cmd == "OPEN_OUT") {
                  remoteOpenOut = true;
                }
                
                if (remoteOpenIn || remoteOpenOut) {
                  // Clear the command from DB so we don't trigger it again
                  StaticJsonDocument<128> clearDoc;
                  clearDoc["pendingCommand"] = "";
                  String clearBody;
                  serializeJson(clearDoc, clearBody);
                  
                  String patchUrl = String(SUPABASE_URL) + "/rest/v1/Relay?bleReaderId=eq." + String(READER_ID);
                  
                  // WE MUST USE A NEW CLIENT FOR THE PATCH REQUEST!
                  WiFiClientSecure patchClient;
                  patchClient.setInsecure();
                  HTTPClient httpPatch;
                  
                  if (httpPatch.begin(patchClient, patchUrl)) {
                    httpPatch.addHeader("apikey", SUPABASE_ANON_KEY);
                    httpPatch.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
                    httpPatch.addHeader("Content-Type", "application/json");
                    httpPatch.addHeader("Prefer", "return=minimal");
                    httpPatch.PATCH(clearBody);
                    httpPatch.end();
                  }
                }
              }
            }
            http.end();
          }
        }
      }
    }
}

'''
    content = content[:start_idx] + new_worker + content[end_idx:]
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
else:
    print("Failed to find bounds")
