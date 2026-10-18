
import re
with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r") as f:
    text = f.read()

fallback_logic_old = """      // Fallback logic for missing network
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
      }"""

fallback_logic_new = """      // Fallback logic for missing network
      updateLCD("NETWORK ERROR", "RECONNECTING...");
      
      preferences.begin("focusx", false);
      preferences.putString("retryPayload", activeReq.payload);
      preferences.putString("retryType", activeReq.scanType);
      preferences.putString("retryEventId", activeReq.eventId);
      preferences.putBool("retryActive", true);
      preferences.end();
      
      triggerBuzzer(1); 
      delay(500);
      ESP.restart(); // Reboot to clear MbedTLS fragmentation and send the saved offline scan!"""

text = text.replace(fallback_logic_old, fallback_logic_new)

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w") as f:
    f.write(text)
print("Reboot logic added!")

