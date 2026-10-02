
import re

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r") as f:
    text = f.read()

# We need to replace the entire httpCode if/else block inside processQueues()
# The block starts with `if (httpCode >= 200 && httpCode < 300) {`
# and ends right before `globalHttp.end();`

old_block_regex = r"if \(httpCode >= 200 && httpCode < 300\) \{.*?delay\(500\);\s*ESP\.restart\(\); \/\/ Reboot to clear MbedTLS fragmentation and send the saved offline scan!\s*\}"

new_block = """if (httpCode >= 200 && httpCode < 300) {
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
          // IF the error is a client error (4xx), DO NOT loop! Just deny it.
          if (httpCode >= 400 && httpCode < 500) {
             res.resultCode = 2; // Treat as DENY
             strncpy(res.message, "BAD REQUEST", sizeof(res.message)-1); res.message[sizeof(res.message)-1] = 0;
          } else {
             res.resultCode = 3; // Trigger Network Error / Retry
             if (httpCode > 0) {
                snprintf(res.message, sizeof(res.message), "HTTP ERROR: %d", httpCode);
             } else {
                strncpy(res.message, "NETWORK OR SERVER ERROR", sizeof(res.message)-1); res.message[sizeof(res.message)-1] = 0;
             }
          }
        }

        if (res.resultCode == 1) { // ALLOW
          Serial.printf("[HTTP] Access Granted: %s\n", res.message);
          updateLCD("ACCESS GRANTED", res.message);
          setAccessGrantedVisual();
          triggerBuzzer(2);
        } 
        else if (res.resultCode == 2) { // DENY
          Serial.printf("[HTTP] Access Denied: %s\n", res.message);
          updateLCD("ACCESS DENIED", res.message);
          setAccessDeniedVisual();
          triggerBuzzer(3);
        } 
        else { // ERROR (Network, 5xx, or malformed)
          Serial.printf("[HTTP] NETWORK OR SERVER ERROR: %s\n", res.message);
          
          updateLCD("NETWORK ERROR", "RECONNECTING...");
          
          preferences.begin("focusx", false);
          preferences.putString("retryPayload", activeReq.payload);
          preferences.putString("retryType", activeReq.scanType);
          preferences.putString("retryEventId", activeReq.eventId);
          preferences.putBool("retryActive", true);
          preferences.end();
          
          triggerBuzzer(1); 
          delay(500);
          ESP.restart(); // Reboot to clear MbedTLS fragmentation and send the saved offline scan!
        }"""

text = re.sub(old_block_regex, new_block, text, flags=re.DOTALL)

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w") as f:
    f.write(text)

print("HTTP logic fixed!")

