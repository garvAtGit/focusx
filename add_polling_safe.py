import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# 1. Remove ESPSupabaseRealtime
content = content.replace('#include <ESPSupabaseRealtime.h>\n', '')
content = content.replace('SupabaseRealtime realtime;\n', '')
content = re.sub(r'void HandleRealtimeChanges\(String result\) \{.*?\}\n\}', '', content, flags=re.DOTALL)
content = re.sub(r'realtime\.begin\(SUPABASE_URL, SUPABASE_ANON_KEY, HandleRealtimeChanges\);\n\s*String filter = "macAddress=eq\." \+ String\(READER_ID\);\n\s*realtime\.addChangesListener\("Relay", "UPDATE", "public", filter\);\n\s*realtime\.listen\(\);\n', '', content)
content = content.replace('if (WiFi.status() == WL_CONNECTED) realtime.loop();', '')

# 2. Modify httpWorkerTask to do polling
polling_logic = """
        // Polling logic
        if (WiFi.status() == WL_CONNECTED) {
          NetworkClientSecure client;
          client.setInsecure();
          HTTPClient http;
          String url = String(SUPABASE_URL) + "/rest/v1/Relay?select=pendingCommand&macAddress=eq." + String(READER_ID);
          http.begin(client, url);
          http.addHeader("apikey", SUPABASE_ANON_KEY);
          http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
          int code = http.GET();
          if (code == 200) {
            String payload = http.getString();
            if (payload != "[]" && payload.length() > 5) {
              StaticJsonDocument<256> doc;
              deserializeJson(doc, payload);
              if (doc.size() > 0 && doc[0].containsKey("pendingCommand")) {
                String cmd = doc[0]["pendingCommand"].as<String>();
                if (cmd != "null" && cmd != "") {
                   // Clear it
                   HTTPClient httpPatch;
                   httpPatch.begin(client, url);
                   httpPatch.addHeader("apikey", SUPABASE_ANON_KEY);
                   httpPatch.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
                   httpPatch.addHeader("Content-Type", "application/json");
                   httpPatch.PATCH("{\\\"pendingCommand\\\": null}");
                   httpPatch.end();
                   
                   // Execute it
                   if (cmd == "open_in") remoteOpenIn = true;
                   if (cmd == "open_out") remoteOpenOut = true;
                }
              }
            }
          }
          http.end();
        }
"""
content = content.replace('if (xQueueReceive(authRequestQueue, &req, 6000 / portTICK_PERIOD_MS) == pdPASS) {', 'if (xQueueReceive(authRequestQueue, &req, 1500 / portTICK_PERIOD_MS) == pdPASS) {')
# Add the polling inside the else block of the queue receive!
content = re.sub(r'(if \(xQueueReceive\(authRequestQueue, &req, 1500 / portTICK_PERIOD_MS\) == pdPASS\) \{.*?\n    \})\n  \}', r'\1 else {' + polling_logic + '\n    }\n  }', content, flags=re.DOTALL)

# Re-add the remoteOpen variables
content = "volatile bool remoteOpenIn = false;\nvolatile bool remoteOpenOut = false;\n" + content

with open(file_path, 'w') as f:
    f.write(content)
