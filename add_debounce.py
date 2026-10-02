import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

old_ir = '''  // INSTANT TRIGGER: Zero Debounce to catch fast/thin objects
  if (digitalRead(IR_PIN) == LOW) {
    if (buzzerType != 3) { 
      Serial.println("[IR] INTRUSION DETECTED");
      triggerBuzzer(3);
      updateLCD("!!! ALARM !!!", "UNAUTHORIZED!");
    }
    alarmEndTime = millis() + 2000; 
  }'''

new_ir = '''  // DEBOUNCE TRIGGER: Wait 10ms to filter out noise/oversensitivity
  static unsigned long irLowStartTime = 0;
  if (digitalRead(IR_PIN) == LOW) {
    if (irLowStartTime == 0) irLowStartTime = millis();
    if (millis() - irLowStartTime > 10) {
      if (buzzerType != 3) { 
        Serial.println("[IR] INTRUSION DETECTED");
        triggerBuzzer(3);
        updateLCD("!!! ALARM !!!", "UNAUTHORIZED!");
      }
      alarmEndTime = millis() + 2000; 
    }
  } else {
    irLowStartTime = 0;
  }'''

text = text.replace(old_ir, new_ir)

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)

print("Added IR debounce")
