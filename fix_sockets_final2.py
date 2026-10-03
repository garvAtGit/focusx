import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# I will fix everything by replacing `http.begin(vercelClient` and `http.begin(supabaseClient` back to `client` inside the worker loop, and restoring the local declaration.
# The previous logic worked, the ONLY issue was the `TIME_WAIT` socket exhaustion.
# The proper way to do Keep-Alive is to declare the `HTTPClient` and `WiFiClientSecure` *OUTSIDE* the `while (true)` loop in `httpWorkerTask`.

# Let's just find httpWorkerTask and rewrite it cleanly using string splitting.
start_str = 'void httpWorkerTask(void *pvParameters) {'
end_str = 'void sendHardwarePing() {'

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_worker = '''void httpWorkerTask(void *pvParameters) {
    AuthRequest req;
    
    // Persistent clients for Keep-Alive
    WiFiClientSecure vercelClient;
    vercelClient.setInsecure();
    WiFiClientSecure supabaseClient;
    supabaseClient.setInsecure();
    
    HTTPClient vercelHttp;
    vercelHttp.setReuse(true);
    
    HTTPClient supabaseHttp;
    supabaseHttp.setReuse(true);
    
    while (true) {
      if (xQueueReceive(authRequestQueue, &req, pdMS_TO_TICKS(3000)) == pdPASS) {
        AuthResponse res;
        res.resultCode = 3;
        strncpy(res.message, "SERVER ERROR", sizeof(res.message)-1);
        res.message[sizeof(res.message)-1] = ' ';
  
        if (WiFi.status() == WL_CONNECTED) {
          if (vercelHttp.begin(vercelClient, API_URL)) {
            vercelHttp.addHeader("Content-Type", "application/json");
            vercelHttp.addHeader("Authorization", String("Bearer ") + HARDWARE_API_KEY);
            vercelHttp.setTimeout(5000);
  
            StaticJsonDocument<256> reqDoc;
            reqDoc["eventId"] = req.eventId;
            reqDoc["readerId"] = READER_ID.c_str();
            reqDoc["scanType"] = req.scanType;
            reqDoc["payload"] = req.payload;
            
            String requestBody;
            serializeJson(reqDoc, requestBody);
            int httpCode = vercelHttp.POST(requestBody);
  
            if (httpCode >= 200 && httpCode < 300) {
              String responseBody = vercelHttp.getString();
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
            // DO NOT CALL vercelHttp.end() IF REUSING!
          }
        }
        xQueueSend(authResponseQueue, &res, 0);
      } else {
        // Idle time: Check for BLE check-ins (Remote Open commands)
        if (WiFi.status() == WL_CONNECTED && String(READER_ID) != "" && (millis() - lastBLEPollTime > 3000)) {
          lastBLEPollTime = millis();
          String url = String(SUPABASE_URL) + "/rest/v1/Relay?bleReaderId=eq." + String(READER_ID) + "&select=pendingCommand";
          if (supabaseHttp.begin(supabaseClient, url)) {
            supabaseHttp.addHeader("apikey", SUPABASE_ANON_KEY);
            supabaseHttp.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
            supabaseHttp.setTimeout(4000);
            int code = supabaseHttp.GET();
            if (code >= 200 && code < 300) {
              String body = supabaseHttp.getString();
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
                  HTTPClient httpPatch;
                  if (httpPatch.begin(supabaseClient, patchUrl)) {
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
            // DO NOT CALL supabaseHttp.end() IF REUSING!
          }
        }
      }
    }
}

'''
    content = content[:start_idx] + new_worker + content[end_idx:]
    
    # Restore client everywhere else!
    content = content.replace('if (http.begin(client, url)) {', 'WiFiClientSecure client; client.setInsecure(); if (http.begin(client, url)) {')
    content = content.replace('if (http.begin(client, String("https://www.focusx.in/api/hardware/check-pin"))) {', 'WiFiClientSecure client; client.setInsecure(); if (http.begin(client, String("https://www.focusx.in/api/hardware/check-pin"))) {')
    content = content.replace('if (http.begin(client, String("https://www.focusx.in/api/hardware/register-pin"))) {', 'WiFiClientSecure client; client.setInsecure(); if (http.begin(client, String("https://www.focusx.in/api/hardware/register-pin"))) {')
    content = content.replace('if (http.begin(client, String("https://www.focusx.in/api/hardware/check-pin?pin=") + pin)) {', 'WiFiClientSecure client; client.setInsecure(); if (http.begin(client, String("https://www.focusx.in/api/hardware/check-pin?pin=") + pin)) {')
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
else:
    print("Failed to find bounds")
