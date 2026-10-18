import re

with open(r'C:\Users\thees\.gemini\antigravity\brain\9ae6d04a-8c06-4063-8018-0d0eb63758a9\unified_esp32_firmware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add grace period
old_allow = '''void processAuthResponse(AuthResponse res) {
  if (res.resultCode == 1) { // ALLOW
    Serial.println("[HTTP] Access Granted");
    if (strlen(res.direction) > 0) {
      updateLCD("ACCESS GRANTED", res.direction);
    } else {
      updateLCD("ACCESS GRANTED", "PLEASE ENTER");
    }
    triggerBuzzer(1);
    digitalWrite(LED_TOGGLE_PIN, HIGH);
  }'''

new_allow = '''void processAuthResponse(AuthResponse res) {
  if (res.resultCode == 1) { // ALLOW
    Serial.println("[HTTP] Access Granted");
    gracePeriodEnd = millis() + 5000;
    if (strlen(res.direction) > 0) {
      updateLCD("ACCESS GRANTED", res.direction);
    } else {
      updateLCD("ACCESS GRANTED", "PLEASE ENTER");
    }
    triggerBuzzer(1);
    digitalWrite(LED_TOGGLE_PIN, HIGH);
  }'''
text = text.replace(old_allow, new_allow)

# 2. Fix HTTP handling to prevent reboot loop on 400 errors, and no setReuse
old_performScan = '''AuthResponse performScan(AuthRequest req) {
  AuthResponse response;
  response.resultCode = 3; 
  strcpy(response.message, "SYSTEM ERROR");
  strcpy(response.direction, "");

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Error: WiFi not connected");
    return response;
  }

  HTTPClient globalHttp;
  globalHttp.setReuse(true); 

  globalHttp.begin(API_URL, rootCACertificate);
  globalHttp.addHeader("Content-Type", "application/json");
  
  String authHeader = String("Bearer ") + HARDWARE_API_KEY;
  globalHttp.addHeader("Authorization", authHeader);
  
  String jsonPayload;
  StaticJsonDocument<512> doc;
  doc["readerId"] = READER_ID;
  doc["scanType"] = req.scanType;
  doc["payload"] = req.payload;
  doc["eventId"] = req.eventId;
  serializeJson(doc, jsonPayload);
  
  Serial.printf("[HTTP] POST %s\n", API_URL);
  Serial.println("[HTTP] Body: " + jsonPayload);

  int httpCode = globalHttp.POST(jsonPayload);
  Serial.printf("[HTTP] Code: %d\n", httpCode);

  if (httpCode > 0) {
    if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) {
      String payload = globalHttp.getString();
      Serial.println("[HTTP] Response: " + payload);

      StaticJsonDocument<512> resDoc;
      DeserializationError error = deserializeJson(resDoc, payload);
      
      if (!error) {
        response.resultCode = resDoc["allow"] ? 1 : 2;
        
        if (resDoc.containsKey("message")) {
          const char* msg = resDoc["message"];
          strncpy(response.message, msg, sizeof(response.message) - 1);
        }
        
        if (resDoc.containsKey("direction")) {
          const char* dir = resDoc["direction"];
          strncpy(response.direction, dir, sizeof(response.direction) - 1);
        }
      } else {
        Serial.println("[HTTP] JSON Parse Error");
      }
    } else {
      Serial.println("[HTTP] Non-200 Response. Rebooting to clear MbedTLS...");
      triggerBuzzer(1); 
      delay(500);
      ESP.restart(); 
    }
  } else {
    Serial.printf("[HTTP] GET... failed, error: %s\n", globalHttp.errorToString(httpCode).c_str());
    Serial.println("[HTTP] Rebooting to clear MbedTLS fragmentation...");
    triggerBuzzer(1); 
    delay(500);
    ESP.restart(); 
  }

  globalHttp.end(); // Keep this! It frees String buffers, but respects keep-alive because of setReuse(true)!
  return response;
}'''

new_performScan = '''AuthResponse performScan(AuthRequest req) {
  AuthResponse response;
  response.resultCode = 3; 
  strcpy(response.message, "SYSTEM ERROR");
  strcpy(response.direction, "");

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Error: WiFi not connected");
    return response;
  }

  HTTPClient globalHttp;
  // REMOVED setReuse(true) because Vercel drops connections after 60s, crashing the ESP32

  globalHttp.begin(API_URL, rootCACertificate);
  globalHttp.addHeader("Content-Type", "application/json");
  
  String authHeader = String("Bearer ") + HARDWARE_API_KEY;
  globalHttp.addHeader("Authorization", authHeader);
  
  String jsonPayload;
  StaticJsonDocument<512> doc;
  doc["readerId"] = READER_ID;
  doc["scanType"] = req.scanType;
  doc["payload"] = req.payload;
  doc["eventId"] = req.eventId;
  serializeJson(doc, jsonPayload);
  
  Serial.printf("[HTTP] POST %s\n", API_URL);
  Serial.println("[HTTP] Body: " + jsonPayload);

  int httpCode = globalHttp.POST(jsonPayload);
  Serial.printf("[HTTP] Code: %d\n", httpCode);

  if (httpCode > 0) {
    if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) {
      String payload = globalHttp.getString();
      Serial.println("[HTTP] Response: " + payload);

      StaticJsonDocument<512> resDoc;
      DeserializationError error = deserializeJson(resDoc, payload);
      
      if (!error) {
        response.resultCode = resDoc["allow"] ? 1 : 2;
        
        if (resDoc.containsKey("message")) {
          const char* msg = resDoc["message"];
          strncpy(response.message, msg, sizeof(response.message) - 1);
        }
        
        if (resDoc.containsKey("direction")) {
          const char* dir = resDoc["direction"];
          strncpy(response.direction, dir, sizeof(response.direction) - 1);
        }
      } else {
        Serial.println("[HTTP] JSON Parse Error");
      }
    } else if (httpCode >= 400 && httpCode < 500) {
      // 4xx errors are client errors (like missing signature, invalid token, etc). Do not reboot!
      Serial.println("[HTTP] 4xx Client Error. Denying access.");
      String payload = globalHttp.getString();
      Serial.println("[HTTP] Response: " + payload);
      
      response.resultCode = 2; // DENY
      StaticJsonDocument<512> resDoc;
      if (!deserializeJson(resDoc, payload)) {
         if (resDoc.containsKey("message")) {
           strncpy(response.message, resDoc["message"], sizeof(response.message) - 1);
         } else {
           strcpy(response.message, "INVALID REQUEST");
         }
      } else {
         strcpy(response.message, "INVALID REQUEST");
      }
    } else {
      Serial.println("[HTTP] Server Error (5xx). Triggering offline cache and reboot...");
      response.resultCode = 3;
    }
  } else {
    Serial.printf("[HTTP] POST failed, error: %s\n", globalHttp.errorToString(httpCode).c_str());
    response.resultCode = 3; // Network error
  }

  globalHttp.end();
  return response;
}'''
text = text.replace(old_performScan, new_performScan)

# 3. Add auto-recovery block at the end of setup
old_setup_end = '''  Serial.println("[SYSTEM] Setup complete. Entering main loop.");
  updateLCD("SYSTEM ARMED", "TAP YOUR CARD");
}'''
new_setup_end = '''  Serial.println("[SYSTEM] Setup complete. Entering main loop.");
  updateLCD("SYSTEM ARMED", "TAP YOUR CARD");

  // RECOVER OFFLINE QUEUE
  preferences.begin("focusx", true);
  if (preferences.getBool("retryActive", false)) {
    pendingRetry = true;
    pendingRetryPayload = preferences.getString("retryPayload", "");
    pendingRetryScanType = preferences.getString("retryType", "");
    pendingRetryEventId = preferences.getString("retryEventId", "");
    pendingRetryTimestamp = preferences.getULong("retryTimestamp", 0);
  }
  preferences.end();
}'''
text = text.replace(old_setup_end, new_setup_end)

# 4. Remove duplicate generateStrongEventId prototype (it's declared twice, causing compile errors in some cores if they mismatch)
text = text.replace('String generateStrongEventId();\n', '')

# 5. Fix PN532 timeout to 10ms
text = re.sub(r'nfc\.readPassiveTargetID\(PN532_MIFARE_ISO14443A, uid, &uidLength, \d+\);', 'nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 10);', text)

# 6. Rewrite checkIR to instant
old_ir = '''void checkIR() {
  if (millis() < gracePeriodEnd) {
    isDetectingIR = false;
    if (buzzerType == 3) {
      buzzerType = 0;
      noTone(BUZZER_PIN);
      if (currentState == STATE_IDLE) setIdleLCD();
    }
    return;
  }

  int irState = digitalRead(IR_PIN);
  bool detected = (irState == LOW);

  if (detected) {
    if (!isDetectingIR) {
      isDetectingIR = true;
      irDetectStartTime = millis();
    } else {
      if (millis() - irDetectStartTime >= 350) {
        if (buzzerType != 3) { 
          Serial.println("[IR] INTRUSION DETECTED");
          triggerBuzzer(3);
          updateLCD("!!! ALARM !!!", "UNAUTHORIZED!");
        }
        alarmEndTime = millis() + 2000; 
      }
    }
  } else {
    isDetectingIR = false;
  }

  if (buzzerType == 3 && millis() > alarmEndTime) {
    buzzerType = 0;
    noTone(BUZZER_PIN);
    Serial.println("[IR] ALARM ENDED");
    if (currentState == STATE_IDLE) {
      setIdleLCD();
    }
  }
}'''
new_ir = '''void checkIR() {
  if (millis() < gracePeriodEnd) {
    if (buzzerType == 3) {
      buzzerType = 0;
      noTone(BUZZER_PIN);
      if (currentState == STATE_IDLE) setIdleLCD();
    }
    return;
  }

  // INSTANT TRIGGER: Zero Debounce to catch fast/thin objects
  if (digitalRead(IR_PIN) == LOW) {
    if (buzzerType != 3) { 
      Serial.println("[IR] INTRUSION DETECTED");
      triggerBuzzer(3);
      updateLCD("!!! ALARM !!!", "UNAUTHORIZED!");
    }
    alarmEndTime = millis() + 2000; 
  }

  if (buzzerType == 3 && millis() > alarmEndTime) {
    buzzerType = 0;
    noTone(BUZZER_PIN);
    Serial.println("[IR] ALARM ENDED");
    if (currentState == STATE_IDLE) {
      setIdleLCD();
    }
  }
}'''
text = text.replace(old_ir, new_ir)

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)
print('Restored everything correctly')
