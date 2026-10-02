import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(
    r'\s*if\s*\(pendingRetry\)\s*\{\s*updateLCD\(\"NET ERROR\",\s*\"TAP TO RETRY\"\);\s*return;\s*\}',
    '',
    text
)

text = re.sub(
    r'currentState\s*=\s*STATE_IDLE;\s*setIdleLCD\(\);\s*\}',
    '''  if (pendingRetry) {
    preferences.begin("focusx", false);
    preferences.putBool("retryActive", false);
    preferences.end();
    pendingRetry = false;
    
    updateLCD("RECOVERING...", "PLEASE WAIT");
    delay(500);
    startAuthorization(pendingRetryPayload, pendingRetryScanType);
  }

  currentState = STATE_IDLE;
  setIdleLCD();
}''',
    text
)

old_block = r'if \(httpCode >= 200 && httpCode < 300\) \{[\s\S]*?globalHttp\.end\(\);'

new_block = '''if (httpCode >= 200 && httpCode < 300) {
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
          if (httpCode >= 400 && httpCode < 500) {
             res.resultCode = 2; // Treat Client Errors (4xx) as Business Denials (No Retry Loop)
             strncpy(res.message, "BAD REQUEST", sizeof(res.message)-1); res.message[sizeof(res.message)-1] = 0;
          } else {
             res.resultCode = 3; // True Network Error or Server Error (5xx)
             if (httpCode > 0) {
                snprintf(res.message, sizeof(res.message), "HTTP ERROR: %d", httpCode);
             } else {
                strncpy(res.message, "NETWORK OR SERVER ERROR", sizeof(res.message)-1); res.message[sizeof(res.message)-1] = 0;
                Serial.println(globalHttp.errorToString(httpCode));
             }
          }
        }
        globalHttp.end();'''

text = re.sub(old_block, new_block, text)

text = re.sub(
    r'\} else \{ \/\/ ERROR \(Network, 5xx, or malformed\)[\s\S]*?updateLCD\(\"NETWORK ERROR\", \"TAP TO RETRY\"\);\s*\}',
    '''} else { // ERROR (Network, 5xx, or malformed)
    Serial.printf("[HTTP] NETWORK OR SERVER ERROR: %s\\n", res.message);
    updateLCD("NETWORK ERROR", "RECONNECTING...");
    
    preferences.begin("focusx", false);
    preferences.putString("retryPayload", activeReq.payload);
    preferences.putString("retryType", activeReq.scanType);
    preferences.putString("retryEventId", activeReq.eventId);
    preferences.putBool("retryActive", true);
    preferences.end();
    
    triggerBuzzer(1); 
    delay(500);
    ESP.restart(); // Flawless reboot to clear MbedTLS fragmentation & instantly send saved scan
  }''',
    text
)

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)
print('Done!')
