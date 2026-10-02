import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

# Add generateStrongEventId before startAuthorization
generate_func = '''// =================================================
// HELPER: EVENT ID GENERATION
// =================================================
String generateStrongEventId() {
  uint8_t randomBytes[16];
  for (int i = 0; i < 16; i++) {
    randomBytes[i] = esp_random() % 256;
  }
  
  // Set UUID version to 4
  randomBytes[6] = (randomBytes[6] & 0x0f) | 0x40;
  // Set UUID variant to 10
  randomBytes[8] = (randomBytes[8] & 0x3f) | 0x80;

  char uuidStr[37];
  snprintf(uuidStr, sizeof(uuidStr), 
    "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
    randomBytes[0], randomBytes[1], randomBytes[2], randomBytes[3],
    randomBytes[4], randomBytes[5], randomBytes[6], randomBytes[7],
    randomBytes[8], randomBytes[9], randomBytes[10], randomBytes[11],
    randomBytes[12], randomBytes[13], randomBytes[14], randomBytes[15]
  );
  
  return String(uuidStr);
}

'''
text = text.replace('void startAuthorization(String payload, String scanType) {', generate_func + 'void startAuthorization(String payload, String scanType) {')

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)
print('Fixed.')
