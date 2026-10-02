
import sys

filepath = r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino"
with open(filepath, "r") as f:
    text = f.read()

# 1. Remove the static "TAP TO RETRY" screen blocker
text = text.replace(
"""  if (pendingRetry) {
    updateLCD("NET ERROR", "TAP TO RETRY");
    return;
  }""",
""
)

# 2. Add automatic resending of offline payload at the very end of setup()
text = text.replace(
"""  currentState = STATE_IDLE;
  setIdleLCD();
}""",
"""  if (pendingRetry) {
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
}"""
)

# 3. Fix the HTTP Error handling inside performScan so it reboots on <0 and 5xx, but denies on 4xx
old_http_handling = """      if (httpCode >= 200 && httpCode < 300) {
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
      globalHttp.end(); // Keep this! It frees String buffers, but respects keep-alive because of setReuse(true)!
    } else {
       strncpy(res.message, "HTTP SETUP FAIL", sizeof(res.message)-1); res.message[sizeof(res.message)-1] = 0;
    }



  } else {
    // BLE Flow
    res.resultCode = 1;
    strncpy(res.message, "BLE TRIGGER", sizeof(res.message)-1); res.message[sizeof(res.message)-1] = 0;
  }
  
  if (res.resultCode == 1) { // ALLOW
    Serial.printf("[HTTP] Access Granted: %s\\n", res.message);
    updateLCD("ACCESS GRANTED", res.message);
    setAccessGrantedVisual();
    triggerBuzzer(2);
  } 
  else if (res.resultCode == 2) { // DENY
    Serial.printf("[HTTP] Access Denied: %s\\n", res.message);
    updateLCD("ACCESS DENIED", res.message);
    setAccessDeniedVisual();
    triggerBuzzer(3);
  } 
  else { // ERROR (Network, 5xx, or malformed)
    Serial.printf("[HTTP] NETWORK OR SERVER ERROR: %s\\n", res.message);
    
    // Fallback logic for missing network
    if (activeReq.scanType == "NFC" || activeReq.scanType == "QR") {
      updateLCD("NETWORK ERROR", "SAVED OFFLINE");
      
      preferences.begin("focusx", false);
      preferences.putString("retryPayload", activeReq.payload);
      preferences.putString("retryType", activeReq.scanType);
      preferences.putString("retryEventId", activeReq.eventId);
      preferences.putBool("retryActive", true);
      preferences.end();
      
      pendingRetry = true;
      pendingRetryPayload = activeReq.payload;
      pendingRetryScanType = activeReq.scanType;
      pendingRetryEventId = activeReq.eventId;
      pendingRetryTimestamp = millis();
      
      triggerBuzzer(1); 
      digitalWrite(LED_TOGGLE_PIN, HIGH);
    } else {
      updateLCD("NETWORK ERROR", "TRY AGAIN");
      triggerBuzzer(1);
    }
  }"""

new_http_handling = """      if (httpCode >= 200 && httpCode < 300) {
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
      globalHttp.end(); // Keep this! It frees String buffers, but respects keep-alive because of setReuse(true)!
    } else {
       res.resultCode = 3;
       strncpy(res.message, "HTTP SETUP FAIL", sizeof(res.message)-1); res.message[sizeof(res.message)-1] = 0;
    }

  } else {
    // BLE Flow
    res.resultCode = 1;
    strncpy(res.message, "BLE TRIGGER", sizeof(res.message)-1); res.message[sizeof(res.message)-1] = 0;
  }
  
  if (res.resultCode == 1) { // ALLOW
    Serial.printf("[HTTP] Access Granted: %s\\n", res.message);
    updateLCD("ACCESS GRANTED", res.message);
    setAccessGrantedVisual();
    triggerBuzzer(2);
  } 
  else if (res.resultCode == 2) { // DENY
    Serial.printf("[HTTP] Access Denied: %s\\n", res.message);
    updateLCD("ACCESS DENIED", res.message);
    setAccessDeniedVisual();
    triggerBuzzer(3);
  } 
  else { // ERROR (Network, 5xx, or malformed)
    Serial.printf("[HTTP] NETWORK OR SERVER ERROR: %s\\n", res.message);
    
    // Save to Offline Queue for Recovery
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
  }"""

if old_http_handling in text:
    text = text.replace(old_http_handling, new_http_handling)
    print("Replaced HTTP handling successfully!")
else:
    print("FAILED TO FIND OLD HTTP HANDLING STRING!")
    
with open(filepath, "w") as f:
    f.write(text)


