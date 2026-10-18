
import re
with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r") as f:
    text = f.read()

fallback_logic_new = """    // Fallback logic for missing network
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

text = re.sub(r"\s*// Fallback logic for missing network.*?\}\s*else\s*\{\s*updateLCD\([^)]+\);\s*triggerBuzzer[^}]+\}\s*\}", "\n" + fallback_logic_new, text, flags=re.DOTALL)

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w") as f:
    f.write(text)
print("Regex replacement done!")

