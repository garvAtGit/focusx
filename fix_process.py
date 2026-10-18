
import re
with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r") as f:
    text = f.read()

process_func = """
void processAuthResponse(AuthResponse res) {
  if (res.resultCode == 1) { // ALLOW
    Serial.println("[HTTP] Access Granted");
    if (strlen(res.direction) > 0) {
      updateLCD("ACCESS GRANTED", res.direction);
    } else {
      updateLCD("ACCESS GRANTED", "PLEASE ENTER");
    }
    triggerBuzzer(1);
    digitalWrite(LED_TOGGLE_PIN, HIGH);
  } 
  else if (res.resultCode == 2) { // DENY
    Serial.printf("[HTTP] Access Denied: %s\\n", res.message);
    updateLCD("ACCESS DENIED", res.message);
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
      
      triggerBuzzer(2);
      digitalWrite(LED_TOGGLE_PIN, HIGH);
    } else {
      updateLCD("NETWORK ERROR", "TRY AGAIN");
      triggerBuzzer(2);
    }
  }

  currentState = STATE_FEEDBACK;
  stateStartTime = millis();
}
"""

text = text.replace("void loop() {", process_func + "\nvoid loop() {")

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w") as f:
    f.write(text)
print("processAuthResponse injected!")

