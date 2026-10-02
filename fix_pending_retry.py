
import re

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r") as f:
    text = f.read()

# Remove the line that says updateLCD("NET ERROR", "TAP TO RETRY"); return;
text = re.sub(
    r"if\s*\(pendingRetry\)\s*\{\s*updateLCD\(\"NET ERROR\",\s*\"TAP TO RETRY\"\);\s*return;\s*\}",
    "",
    text
)

# In setup(), add the auto-recovery at the end!
# We look for `currentState = STATE_IDLE; setIdleLCD(); }` which is the end of setup()
end_setup_replacement = """
  if (pendingRetry) {
    preferences.begin("focusx", false);
    preferences.putBool("retryActive", false);
    preferences.end();
    
    updateLCD("RECOVERING...", "PLEASE WAIT");
    delay(500);
    
    AuthRequest req;
    req.eventId = pendingRetryEventId;
    req.scanType = pendingRetryScanType;
    req.payload = pendingRetryPayload;
    xQueueSend(authRequestQueue, &req, portMAX_DELAY);
    
    pendingRetry = false;
  }

  currentState = STATE_IDLE;
  setIdleLCD();
}"""

text = text.replace("  currentState = STATE_IDLE;\n  setIdleLCD();\n}", end_setup_replacement)

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w") as f:
    f.write(text)

print("Fixed auto-recovery logic!")

