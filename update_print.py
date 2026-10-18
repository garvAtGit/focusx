import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

old_err = '''  } else { // ERROR (Network, 5xx, or malformed)
    // We intentionally LEAVE pendingRetry = true and do not clear NVS.
    // This allows recovery across reboots or user-driven retries.
    Serial.printf("[HTTP] NETWORK OR SERVER ERROR: %s\\n", res.message);
    pendingRetry = true; 
    pendingRetryTimestamp = millis(); // Snapshot time of failure
    updateLCD("NETWORK ERROR", "TAP TO RETRY");
  }'''

new_err = '''  } else { // ERROR (Network, 5xx, or malformed)
    // We intentionally LEAVE pendingRetry = true and do not clear NVS.
    // This allows recovery across reboots or user-driven retries.
    Serial.printf("[HTTP] NETWORK OR SERVER ERROR: %s\\n", res.message);
    pendingRetry = true; 
    pendingRetryTimestamp = millis(); // Snapshot time of failure
    
    if (strlen(res.message) > 0) {
      updateLCD("NET ERR:", res.message);
    } else {
      updateLCD("NETWORK ERROR", "TAP TO RETRY");
    }
  }'''

text = text.replace(old_err, new_err)

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated print")
