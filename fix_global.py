
import re
with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r") as f:
    text = f.read()

# Add globals
global_vars = """
Preferences preferences;

WiFiClientSecure globalClient;
HTTPClient globalHttp;
"""
text = text.replace("Preferences preferences;", global_vars)

# Replace in performScan
scan_body = """
  if (WiFi.status() == WL_CONNECTED) {
    globalClient.setInsecure();
    if (globalHttp.begin(globalClient, API_URL)) {
      globalHttp.addHeader("Content-Type", "application/json");
      globalHttp.addHeader("Authorization", String("Bearer ") + HARDWARE_API_KEY);
      globalHttp.addHeader("Connection", "close");
      globalHttp.setTimeout(15000);

      StaticJsonDocument<256> reqDoc;
      reqDoc["eventId"] = req.eventId;
      reqDoc["readerId"] = readerId;
      reqDoc["scanType"] = req.scanType;
      reqDoc["payload"] = req.payload;

      String requestBody;
      serializeJson(reqDoc, requestBody);
      int httpCode = globalHttp.POST(requestBody);

      if (httpCode >= 200 && httpCode < 300) {
        String responseBody = globalHttp.getString();
        StaticJsonDocument<256> resDoc;
        deserializeJson(resDoc, responseBody);

        res.resultCode = 0;
        strncpy(res.message, resDoc["message"] | "PROCESSED", sizeof(res.message)-1); res.message[sizeof(res.message)-1] = 0;
        strncpy(res.direction, resDoc["direction"] | "", sizeof(res.direction)-1); res.direction[sizeof(res.direction)-1] = 0;

        String st = resDoc["status"] | "";
        if (st == "ALLOW") res.resultCode = 1;
        else if (st == "DENY") res.resultCode = 2;
      } else {
        res.resultCode = 3;
        if (httpCode > 0) {
           snprintf(res.message, sizeof(res.message), "HTTP ERROR: %d", httpCode);
        } else {
           strncpy(res.message, "NETWORK OR SERVER ERROR", sizeof(res.message)-1); res.message[sizeof(res.message)-1] = 0;
           Serial.println(globalHttp.errorToString(httpCode));
        }
      }
      globalHttp.end();
      globalClient.stop();
    } else {
       strncpy(res.message, "HTTP SETUP FAIL", sizeof(res.message)-1); res.message[sizeof(res.message)-1] = 0;
    }
"""

text = re.sub(r"\s+if \(WiFi\.status\(\) == WL_CONNECTED\) \{.*?HTTP SETUP FAIL.*?\}", "\n" + scan_body, text, flags=re.DOTALL)

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w") as f:
    f.write(text)
print("Globals injected!")

