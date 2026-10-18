
import re
with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r") as f:
    text = f.read()

# Replace startAuthorization
start_old = r"void startAuthorization\(String payload, String scanType\)\s*\{\s*AuthRequest req;\s*req\.eventId = generateEventId\(\);\s*req\.scanType = scanType;\s*req\.payload = payload;\s*if \(xQueueSend\(authRequestQueue, &req, 0\) == pdPASS\) \{\s*activeReq = req;\s*currentState = STATE_AUTHORIZING;\s*updateLCD\(\"AUTHORIZING\.\.\.\", \"PLEASE WAIT\"\);\s*\} else \{\s*Serial\.println\(\"\[AUTH\] Queue full\!\"\);\s*triggerBuzzer\(4\);\s*\}\s*\}"
start_new = """void startAuthorization(String payload, String scanType) {
  AuthRequest req;
  req.eventId = generateEventId();
  req.scanType = scanType;
  req.payload = payload;

  activeReq = req;
  currentState = STATE_AUTHORIZING;
  updateLCD("AUTHORIZING...", "PLEASE WAIT");
}"""

if re.search(start_old, text):
    text = re.sub(start_old, start_new, text)
else:
    # Try a looser match
    text = re.sub(r"if\s*\(xQueueSend\(authRequestQueue,\s*&req,\s*0\)\s*==\s*pdPASS\)\s*\{([\s\S]*?)\} else \{[\s\S]*?triggerBuzzer\(4\);\s*\}", r"\1", text)


# Remove queue creation in setup
text = re.sub(r"authRequestQueue = xQueueCreate\([^;]+;\s*authResponseQueue = xQueueCreate[^;]+;", "", text)
text = text.replace("authRequestQueue = xQueueCreate(1, sizeof(AuthRequest));", "")
text = text.replace("authResponseQueue = xQueueCreate(1, sizeof(AuthResponse));", "")

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w") as f:
    f.write(text)
print("Queues cleaned!")

