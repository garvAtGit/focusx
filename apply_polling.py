import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# Add a global for polling time
content = content.replace('unsigned long lastPingTime = 0;', 'unsigned long lastPingTime = 0;\nunsigned long lastBLEPollTime = 0;')

# Replace the httpWorkerTask implementation
old_task = '''void httpWorkerTask(void *pvParameters) {
  AuthRequest req;
  while (true) {
    if (xQueueReceive(authRequestQueue, &req, portMAX_DELAY) == pdPASS) {
      AuthResponse res;
      res.resultCode = 3;
      strncpy(res.message, "SERVER ERROR", sizeof(res.message)-1);
      res.message[sizeof(res.message)-1] = '\\0';

      if (WiFi.status() == WL_CONNECTED) {
        WiFiClientSecure client;
        client.setInsecure(); // Standard approach for ESP32
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
                       res.direction[15] = ' ';
                   } else {
                       strcpy(res.direction, "IN");
                   }
              } else {
                 res.resultCode = 2; // Denied
              }
            }
          }
          http.end();
        }
      }
      xQueueSend(authResponseQueue, &res, 0);
    }
  }
}'''

new_task = '''void httpWorkerTask(void *pvParameters) {
  AuthRequest req;
  while (true) {
    if (xQueueReceive(authRequestQueue, &req, pdMS_TO_TICKS(3000)) == pdPASS) {
      AuthResponse res;
      res.resultCode = 3;
      strncpy(res.message, "SERVER ERROR", sizeof(res.message)-1);
      res.message[sizeof(res.message)-1] = '\\0';

      if (WiFi.status() == WL_CONNECTED) {
        WiFiClientSecure client;
        client.setInsecure(); // Standard approach for ESP32
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
              }
            }
          }
          http.end();
        }
      }
      xQueueSend(authResponseQueue, &res, 0);
    } else {
      // Idle time: Check for BLE check-ins (Remote Open commands)
      if (WiFi.status() == WL_CONNECTED && String(READER_ID) != "" && (millis() - lastBLEPollTime > 3000)) {
        lastBLEPollTime = millis();
        WiFiClientSecure client;
        client.setInsecure();
        HTTPClient http;
        String url = String(SUPABASE_URL) + "/rest/v1/Relay?bleReaderId=eq." + String(READER_ID) + "&select=pendingCommand";
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
                http.end();
                HTTPClient httpPatch;
                String patchUrl = String(SUPABASE_URL) + "/rest/v1/Relay?bleReaderId=eq." + String(READER_ID);
                if (httpPatch.begin(client, patchUrl)) {
                  httpPatch.addHeader("apikey", SUPABASE_ANON_KEY);
                  httpPatch.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
                  httpPatch.addHeader("Content-Type", "application/json");
                  httpPatch.addHeader("Prefer", "return=minimal");
                  httpPatch.PATCH("{\\"pendingCommand\\": null}");
                  httpPatch.end();
                }
                continue; // Done handling BLE command
              }
            }
          }
          http.end();
        }
      }
    }
  }
}'''

if old_task in content:
    content = content.replace(old_task, new_task)
    print("Successfully replaced httpWorkerTask")
else:
    print("Could not find exact httpWorkerTask string. Doing regex replace.")
    # Fallback to regex if exact string mismatch due to line endings etc.
    content = re.sub(r'void httpWorkerTask.*?xQueueSend\(authResponseQueue, &res, 0\);\s*\}\s*\}\s*\}', new_task, content, flags=re.DOTALL)

with open(file_path, 'w') as f:
    f.write(content)
