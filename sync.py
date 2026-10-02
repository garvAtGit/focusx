import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Remove Queue definitions
text = text.replace('QueueHandle_t authRequestQueue;', '')
text = text.replace('QueueHandle_t authResponseQueue;', '')

# 2. Convert httpWorkerTask to performScan
old_httpWorkerTask = '''// =================================================
// BACKGROUND HTTP WORKER TASK (TLS ENABLED)
// =================================================
void httpWorkerTask(void *pvParameters) {
  AuthRequest req;
  
  while (true) {
    if (xQueueReceive(authRequestQueue, &req, portMAX_DELAY) == pdPASS) {
      AuthResponse res;
      res.resultCode = 3; // Default to ERROR
      strncpy(res.message, "SERVER ERROR", sizeof(res.message)-1);
      res.message[sizeof(res.message)-1] = '\0';
      
      strncpy(res.direction, "", sizeof(res.direction)-1);
      res.direction[sizeof(res.direction)-1] = '\0';

      if (WiFi.status() == WL_CONNECTED) {
        WiFiClientSecure client;
        client.setCACert(rootCACertificate); // Strict TLS Validation
        
        HTTPClient http;
        if (http.begin(client, API_URL)) {
          http.addHeader("Content-Type", "application/json");
          http.addHeader("Authorization", String("Bearer ") + HARDWARE_API_KEY);
          http.setTimeout(5000);

          StaticJsonDocument<256> reqDoc;
          reqDoc["eventId"] = req.eventId;
          reqDoc["readerId"] = READER_ID;
          reqDoc["scanType"] = req.scanType;
          reqDoc["payload"] = req.payload;
          
          String requestBody;
          serializeJson(reqDoc, requestBody);

          int httpCode = http.POST(requestBody);

          if (httpCode > 0) {
            if (httpCode == HTTP_CODE_OK) {
              String responseBody = http.getString();
              StaticJsonDocument<256> resDoc;
              DeserializationError error = deserializeJson(resDoc, responseBody);
              
              if (!error) {
                res.resultCode = resDoc["allow"] ? 1 : 2;
                if (resDoc.containsKey("message")) strncpy(res.message, resDoc["message"], sizeof(res.message)-1);
                if (resDoc.containsKey("direction")) strncpy(res.direction, resDoc["direction"], sizeof(res.direction)-1);
              }
            } else {
              strncpy(res.message, "ACCESS DENIED", sizeof(res.message)-1);
              res.resultCode = 2; // Server returned non-200, assume denied.
            }
          }
          http.end();
        }
      }
      
      xQueueSend(authResponseQueue, &res, portMAX_DELAY);
    }
  }
}'''

new_performScan = '''// =================================================
// SYNCHRONOUS HTTP SCAN
// =================================================
AuthResponse performScan(AuthRequest req) {
  AuthResponse res;
  res.resultCode = 3; 
  strncpy(res.message, "SYSTEM ERROR", sizeof(res.message)-1);
  res.message[sizeof(res.message)-1] = '\0';
  
  strncpy(res.direction, "", sizeof(res.direction)-1);
  res.direction[sizeof(res.direction)-1] = '\0';

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Error: WiFi not connected");
    return res;
  }

  WiFiClientSecure client;
  client.setCACert(rootCACertificate); 
  
  HTTPClient http;
  if (http.begin(client, API_URL)) {
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", String("Bearer ") + HARDWARE_API_KEY);
    http.setTimeout(5000);

    StaticJsonDocument<256> reqDoc;
    reqDoc["eventId"] = req.eventId;
    reqDoc["readerId"] = READER_ID;
    reqDoc["scanType"] = req.scanType;
    reqDoc["payload"] = req.payload;
    
    String requestBody;
    serializeJson(reqDoc, requestBody);

    int httpCode = http.POST(requestBody);
    Serial.printf("[HTTP] Code: %d\\n", httpCode);

    if (httpCode > 0) {
      if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) {
        String responseBody = http.getString();
        StaticJsonDocument<256> resDoc;
        DeserializationError error = deserializeJson(resDoc, responseBody);
        
        if (!error) {
          res.resultCode = resDoc["allow"] ? 1 : 2;
          if (resDoc.containsKey("message")) strncpy(res.message, resDoc["message"], sizeof(res.message)-1);
          if (resDoc.containsKey("direction")) strncpy(res.direction, resDoc["direction"], sizeof(res.direction)-1);
        }
      } else if (httpCode >= 400 && httpCode < 500) {
        Serial.println("[HTTP] 4xx Client Error. Denying access.");
        String payload = http.getString();
        res.resultCode = 2; // DENY
        StaticJsonDocument<256> resDoc;
        if (!deserializeJson(resDoc, payload) && resDoc.containsKey("message")) {
           strncpy(res.message, resDoc["message"], sizeof(res.message)-1);
        } else {
           strncpy(res.message, "INVALID REQUEST", sizeof(res.message)-1);
        }
      } else {
        Serial.println("[HTTP] Server Error (5xx). Triggering offline cache and reboot...");
        res.resultCode = 3;
      }
    } else {
      Serial.printf("[HTTP] POST failed, error: %s\\n", http.errorToString(httpCode).c_str());
      res.resultCode = 3;
    }
    http.end();
  }
  return res;
}'''
text = text.replace(old_httpWorkerTask, new_performScan)

# 3. Change startAuthorization to synchronous state trigger
old_startAuth = '''void startAuthorization(String payload, String scanType) {
  if (currentState != STATE_IDLE) return;
  
  AuthRequest req;
  strncpy(req.scanType, scanType.c_str(), sizeof(req.scanType) - 1);
  strncpy(req.payload, payload.c_str(), sizeof(req.payload) - 1);
  strncpy(req.eventId, generateStrongEventId().c_str(), sizeof(req.eventId) - 1);

  activeReq = req;
  xQueueSend(authRequestQueue, &req, portMAX_DELAY);

  currentState = STATE_AUTHORIZING;
  updateLCD("AUTHORIZING...", "PLEASE WAIT");
}'''
new_startAuth = '''void startAuthorization(String payload, String scanType) {
  if (currentState != STATE_IDLE) return;
  
  AuthRequest req;
  strncpy(req.scanType, scanType.c_str(), sizeof(req.scanType) - 1);
  strncpy(req.payload, payload.c_str(), sizeof(req.payload) - 1);
  strncpy(req.eventId, generateStrongEventId().c_str(), sizeof(req.eventId) - 1);

  activeReq = req;
  currentState = STATE_AUTHORIZING;
  updateLCD("AUTHORIZING...", "PLEASE WAIT");
}'''
text = text.replace(old_startAuth, new_startAuth)

# 4. Remove setup() FreeRTOS initialization
old_setup_freertos = '''  // 6. FREERTOS TASK QUEUES (Length 1)
  authRequestQueue = xQueueCreate(1, sizeof(AuthRequest));
  authResponseQueue = xQueueCreate(1, sizeof(AuthResponse));
  
  if (!authRequestQueue || !authResponseQueue) {
    Serial.println("[ERROR] Failed to create FreeRTOS queues! Halting.");
    updateLCD("SYS HALT", "MEM ERROR");
    while(true) delay(100);
  }
  
  BaseType_t taskStatus = xTaskCreatePinnedToCore(
    httpWorkerTask, 
    "HTTP_Worker_Task", 
    8192, 
    NULL, 
    1, 
    NULL, 
    1
  );

  if (taskStatus != pdPASS) {
    Serial.println("[ERROR] Failed to create HTTP Worker Task! Halting.");
    updateLCD("SYS HALT", "TASK ERROR");
    while(true) delay(100);
  }'''
text = text.replace(old_setup_freertos, '')

# 5. Fix STATE_AUTHORIZING in loop()
old_loop_authorizing = '''    case STATE_AUTHORIZING:
      // Awaiting response from FreeRTOS task queue
      AuthResponse res;
      if (xQueueReceive(authResponseQueue, &res, 0) == pdPASS) {
        processAuthResponse(res);
      }
      break;'''
new_loop_authorizing = '''    case STATE_AUTHORIZING:
      {
        AuthResponse res = performScan(activeReq);
        processAuthResponse(res);
      }
      break;'''
text = text.replace(old_loop_authorizing, new_loop_authorizing)

# 6. Add auto-recovery block at the end of setup
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

# 7. Add Network Error fallback handling to processAuthResponse
old_processAuth = '''void processAuthResponse(AuthResponse res) {
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
  } else { // DENY OR ERROR
    Serial.printf("[HTTP] Access Denied / Error: %s\\n", res.message);
    updateLCD("ACCESS DENIED", res.message);
    triggerBuzzer(3);
  }

  stateStartTime = millis();
  currentState = STATE_FEEDBACK;
}'''
new_processAuth = '''void processAuthResponse(AuthResponse res) {
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
  } else if (res.resultCode == 2) { // DENY
    Serial.printf("[HTTP] Access Denied: %s\\n", res.message);
    updateLCD("ACCESS DENIED", res.message);
    triggerBuzzer(3);
  } else { // ERROR (Network, 5xx, or malformed)
    Serial.printf("[HTTP] NETWORK OR SERVER ERROR: %s\\n", res.message);
    updateLCD("NETWORK ERROR", "RECONNECTING...");
    
    preferences.begin("focusx", false);
    preferences.putString("retryPayload", activeReq.payload);
    preferences.putString("retryType", activeReq.scanType);
    preferences.putString("retryEventId", activeReq.eventId);
    preferences.putULong("retryTimestamp", millis());
    preferences.putBool("retryActive", true);
    preferences.end();

    triggerBuzzer(1); 
    delay(500);
    ESP.restart(); // Clear TLS fragmentation and instantly trigger reboot recovery
  }

  stateStartTime = millis();
  currentState = STATE_FEEDBACK;
}'''
text = text.replace(old_processAuth, new_processAuth)

# 8. Add retry execution in STATE_FEEDBACK
old_feedback = '''    case STATE_FEEDBACK:
      if (millis() - stateStartTime >= 2500) {
        currentState = STATE_IDLE;
        setIdleLCD();
      }
      break;'''
new_feedback = '''    case STATE_FEEDBACK:
      if (millis() - stateStartTime >= 2500) {
          if (pendingRetry) {
            preferences.begin("focusx", false);
            preferences.putBool("retryActive", false);
            preferences.end();
            pendingRetry = false;
            
            updateLCD("RECOVERING...", "PLEASE WAIT");
            delay(500);
            startAuthorization(pendingRetryPayload, pendingRetryScanType);
            return;
          }
        currentState = STATE_IDLE;
        setIdleLCD();
      }
      break;'''
text = text.replace(old_feedback, new_feedback)

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)
print('Synchronous conversion done.')
