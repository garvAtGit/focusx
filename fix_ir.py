import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix 1: Add gracePeriodEnd = millis() + 5000;
old_allow = '''void processAuthResponse(AuthResponse res) {
  if (res.resultCode == 1) { // ALLOW
    Serial.println("[HTTP] Access Granted");
    if (strlen(res.direction) > 0) {
      updateLCD("ACCESS GRANTED", res.direction);
    } else {
      updateLCD("ACCESS GRANTED", "PLEASE ENTER");
    }
    triggerBuzzer(1);
    digitalWrite(LED_TOGGLE_PIN, HIGH);
  }'''

new_allow = '''void processAuthResponse(AuthResponse res) {
  if (res.resultCode == 1) { // ALLOW
    Serial.println("[HTTP] Access Granted");
    gracePeriodEnd = millis() + 5000; // FIX: Added grace period so they don't trip the alarm!
    if (strlen(res.direction) > 0) {
      updateLCD("ACCESS GRANTED", res.direction);
    } else {
      updateLCD("ACCESS GRANTED", "PLEASE ENTER");
    }
    triggerBuzzer(1);
    digitalWrite(LED_TOGGLE_PIN, HIGH);
  }'''

text = text.replace(old_allow, new_allow)

# Fix 2: Change IR debounce from 350 to 50
old_ir = '''    } else {
      if (millis() - irDetectStartTime >= 350) {
        if (buzzerType != 3) {'''

new_ir = '''    } else {
      if (millis() - irDetectStartTime >= 50) { // FIX: Lowered debounce to 50ms to catch fast walkers
        if (buzzerType != 3) {'''

text = text.replace(old_ir, new_ir)

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)
print('Fixed IR and Buzzer logic')
