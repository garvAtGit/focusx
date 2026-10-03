import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# 1. Change NetworkClientSecure to WiFiClientSecure
content = content.replace('#include <NetworkClientSecure.h>', '#include <WiFiClientSecure.h>')
content = content.replace('NetworkClientSecure', 'WiFiClientSecure')

# 2. Reuse HTTPClient
polling_replacement = """
        // Polling logic
        if (WiFi.status() == WL_CONNECTED) {
          WiFiClientSecure client;
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
                   http.end(); // close GET request
                   
                   // Clear it
                   http.begin(client, url);
                   http.addHeader("apikey", SUPABASE_ANON_KEY);
                   http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
                   http.addHeader("Content-Type", "application/json");
                   http.PATCH("{\\\"pendingCommand\\\": null}");
                   http.end();
                   
                   // Execute it
                   if (cmd == "open_in") remoteOpenIn = true;
                   if (cmd == "open_out") remoteOpenOut = true;
                }
              }
            }
          } else {
             http.end();
          }
        }
"""
content = re.sub(r'        // Polling logic.*?        \}', polling_replacement, content, flags=re.DOTALL)

with open(file_path, 'w') as f:
    f.write(content)
