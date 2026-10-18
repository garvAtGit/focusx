import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# 1. Remove the separate pollCommandTask and its spawn line
content = re.sub(r'void pollCommandTask\(void \*pvParameters\) \{.*?\n  \}\n\}\n', '', content, flags=re.DOTALL)
content = content.replace('xTaskCreatePinnedToCore(pollCommandTask, "Poll", 8192, NULL, 1, NULL, 0);', '')

# 2. Modify httpWorkerTask to do both
http_task_code = """void httpWorkerTask(void *pvParameters) {
  AuthRequest req;
  while (true) {
    if (xQueueReceive(authRequestQueue, &req, 1500 / portTICK_PERIOD_MS) == pdPASS) {
      // We got an RFID request!
      if (WiFi.status() == WL_CONNECTED) {
        NetworkClientSecure client;
        client.setInsecure();
        HTTPClient http;
        http.begin(client, API_URL);
        http.addHeader("Content-Type", "application/json");
        http.addHeader("Authorization", "Bearer " + String(HARDWARE_API_KEY));
        
        StaticJsonDocument<256> doc;
        doc["uid"] = req.payload;
        doc["readerId"] = READER_ID;
        doc["scanType"] = req.scanType;
        doc["eventId"] = req.eventId;
        String requestBody;
        serializeJson(doc, requestBody);
        
        int httpCode = http.POST(requestBody);
        if (httpCode >= 200 && httpCode < 300) {
          String responseBody = http.getString();
          StaticJsonDocument<512> resDoc;
          DeserializationError err = deserializeJson(resDoc, responseBody);
          if (!err && resDoc.containsKey("status")) {
            String st = resDoc["status"].as<String>();
            AuthResponse res;
            if (st == "APPROVED" || st == "GRANTED" || st == "ALLOW") {
              res.resultCode = 1;
              if (resDoc.containsKey("direction")) {
                strncpy(res.direction, resDoc["direction"].as<const char*>(), sizeof(res.direction)-1);
              } else {
                strcpy(res.direction, "UNKNOWN");
              }
            } else {
              res.resultCode = 2;
              strncpy(res.message, resDoc["message"] | "DENIED", sizeof(res.message)-1);
            }
            xQueueSend(authResponseQueue, &res, 0);
          } else {
            AuthResponse res;
            res.resultCode = 3;
            strncpy(res.message, "BAD JSON", sizeof(res.message)-1);
            xQueueSend(authResponseQueue, &res, 0);
          }
        } else {
          AuthResponse res;
          res.resultCode = 3;
          strncpy(res.message, "SERVER ERROR", sizeof(res.message)-1);
          xQueueSend(authResponseQueue, &res, 0);
        }
        http.end();
      } else {
        AuthResponse res;
        res.resultCode = 3;
        strncpy(res.message, "NO WIFI", sizeof(res.message)-1);
        xQueueSend(authResponseQueue, &res, 0);
      }
    } else {
      // Timeout hit (1.5s elapsed without RFID). Do BLE Polling!
      if (WiFi.status() == WL_CONNECTED && String(READER_ID) != "") {
        NetworkClientSecure client;
        client.setInsecure();
        HTTPClient http;
        String url = String(SUPABASE_URL) + "/rest/v1/Relay?macAddress=eq." + String(READER_ID) + "&select=pendingCommand";
        http.begin(client, url);
        http.addHeader("apikey", SUPABASE_ANON_KEY);
        http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
        http.addHeader("Content-Type", "application/json");
        
        int httpCode = http.GET();
        if (httpCode >= 200 && httpCode < 300) {
          String res = http.getString();
          if (res.indexOf("open_in") != -1) {
            remoteOpenIn = true;
          } else if (res.indexOf("open_out") != -1) {
            remoteOpenOut = true;
          }
          
          if (remoteOpenIn || remoteOpenOut) {
            HTTPClient patchHttp;
            String patchUrl = String(SUPABASE_URL) + "/rest/v1/Relay?macAddress=eq." + String(READER_ID);
            patchHttp.begin(client, patchUrl);
            patchHttp.addHeader("apikey", SUPABASE_ANON_KEY);
            patchHttp.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
            patchHttp.addHeader("Content-Type", "application/json");
            patchHttp.addHeader("Prefer", "return=minimal");
            patchHttp.PATCH("{\\\"pendingCommand\\\": null}");
            patchHttp.end();
          }
        }
        http.end();
      }
    }
  }
}"""

content = re.sub(r'void httpWorkerTask\(void \*pvParameters\) \{.*?\n      \}\n    \}\n  \}\n\}', http_task_code, content, flags=re.DOTALL)

with open(file_path, 'w') as f:
    f.write(content)
