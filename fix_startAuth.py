import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

old_auth = '''void startAuthorization(String payload, String scanType) {
  AuthRequest req;
  req.eventId = generateEventId();
  req.scanType = scanType;
  req.payload = payload;

  activeReq = req;'''

new_auth = '''String generateStrongEventId() {
  return String(millis()) + "-" + String(random(1000, 9999));
}

void startAuthorization(String payload, String scanType) {
  AuthRequest req;
  strncpy(req.eventId, generateStrongEventId().c_str(), sizeof(req.eventId) - 1);
  req.eventId[sizeof(req.eventId) - 1] = 0;
  
  strncpy(req.scanType, scanType.c_str(), sizeof(req.scanType) - 1);
  req.scanType[sizeof(req.scanType) - 1] = 0;
  
  strncpy(req.payload, payload.c_str(), sizeof(req.payload) - 1);
  req.payload[sizeof(req.payload) - 1] = 0;

  activeReq = req;'''

text = text.replace(old_auth, new_auth)

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)
print('Fixed startAuthorization')
