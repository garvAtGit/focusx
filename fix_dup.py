import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
'''String generateStrongEventId() {
  return String(millis()) + "-" + String(random(1000, 9999));
}

void startAuthorization(String payload, String scanType) {''',
'''void startAuthorization(String payload, String scanType) {'''
)

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)
print('Removed duplicate')
