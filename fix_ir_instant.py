import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix 1: Lower PN532 timeout so loop runs faster (eliminates 40ms blindspots)
text = re.sub(r'nfc\.readPassiveTargetID\(PN532_MIFARE_ISO14443A, uid, &uidLength, \d+\);', 'nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 10);', text)

# Fix 2: Rewrite checkIR to trigger instantly
old_ir = '''void checkIR() {
  if (millis() < gracePeriodEnd) {
    isDetectingIR = false;
    if (buzzerType == 3) {
      buzzerType = 0;
      digitalWrite(BUZZER_PIN, LOW);
      if (currentState == STATE_IDLE) setIdleLCD();
    }
    return;
  }

  int irState = digitalRead(IR_PIN);
  bool detected = (irState == LOW);

  if (detected) {
    if (!isDetectingIR) {
      isDetectingIR = true;
      irDetectStartTime = millis();
    } else {
      if (millis() - irDetectStartTime >= 10) { // FIX: Lowered debounce to 10ms for instant detection
        if (buzzerType != 3) { 
          Serial.println("[IR] INTRUSION DETECTED");
          triggerBuzzer(3);
          updateLCD("!!! ALARM !!!", "UNAUTHORIZED!");
        }
        alarmEndTime = millis() + 2000; 
      }
    }
  } else {
    isDetectingIR = false;
  }

  if (buzzerType == 3 && millis() > alarmEndTime) {
    buzzerType = 0;
    digitalWrite(BUZZER_PIN, LOW);
    Serial.println("[IR] ALARM ENDED");
    if (currentState == STATE_IDLE) {
      setIdleLCD();
    }
  }
}'''

new_ir = '''void checkIR() {
  if (millis() < gracePeriodEnd) {
    if (buzzerType == 3) {
      buzzerType = 0;
      digitalWrite(BUZZER_PIN, LOW);
      if (currentState == STATE_IDLE) setIdleLCD();
    }
    return;
  }

  // INSTANT TRIGGER: Zero Debounce to catch fast/thin objects
  if (digitalRead(IR_PIN) == LOW) {
    if (buzzerType != 3) { 
      Serial.println("[IR] INTRUSION DETECTED");
      triggerBuzzer(3);
      updateLCD("!!! ALARM !!!", "UNAUTHORIZED!");
    }
    alarmEndTime = millis() + 2000; 
  }

  if (buzzerType == 3 && millis() > alarmEndTime) {
    buzzerType = 0;
    digitalWrite(BUZZER_PIN, LOW);
    Serial.println("[IR] ALARM ENDED");
    if (currentState == STATE_IDLE) {
      setIdleLCD();
    }
  }
}'''

text = text.replace(old_ir, new_ir)

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)
print('Fixed IR instant trigger and loop blindspot')
