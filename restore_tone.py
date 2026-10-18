import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

# Original processBuzzer code with tone()
old_buzzer_start = 'void triggerBuzzer(int type) {'
old_buzzer_end = '// =================================================\n// MAIN LOOP'

new_buzzer = '''void triggerBuzzer(int type) {
  buzzerType = type;
  buzzerState = 1;
  buzzerNextTime = millis();
}

void processBuzzer() {
  if (buzzerType == 0) return;
  if (millis() < buzzerNextTime) return;

  if (buzzerType == 1) { // Entry Chime
    switch (buzzerState) {
      case 1: tone(BUZZER_PIN, 523); buzzerNextTime = millis() + 100; buzzerState++; break;
      case 2: noTone(BUZZER_PIN); buzzerNextTime = millis() + 20; buzzerState++; break;
      case 3: tone(BUZZER_PIN, 659); buzzerNextTime = millis() + 100; buzzerState++; break;
      case 4: noTone(BUZZER_PIN); buzzerNextTime = millis() + 20; buzzerState++; break;
      case 5: tone(BUZZER_PIN, 784); buzzerNextTime = millis() + 100; buzzerState++; break;
      case 6: noTone(BUZZER_PIN); buzzerNextTime = millis() + 20; buzzerState++; break;
      case 7: tone(BUZZER_PIN, 1047); buzzerNextTime = millis() + 300; buzzerState++; break;
      default: noTone(BUZZER_PIN); buzzerType = 0; break;
    }
  } else if (buzzerType == 2) { // Exit Chime
    switch (buzzerState) {
      case 1: tone(BUZZER_PIN, 1047); buzzerNextTime = millis() + 100; buzzerState++; break;
      case 2: noTone(BUZZER_PIN); buzzerNextTime = millis() + 20; buzzerState++; break;
      case 3: tone(BUZZER_PIN, 784); buzzerNextTime = millis() + 100; buzzerState++; break;
      case 4: noTone(BUZZER_PIN); buzzerNextTime = millis() + 20; buzzerState++; break;
      case 5: tone(BUZZER_PIN, 659); buzzerNextTime = millis() + 100; buzzerState++; break;
      case 6: noTone(BUZZER_PIN); buzzerNextTime = millis() + 20; buzzerState++; break;
      case 7: tone(BUZZER_PIN, 523); buzzerNextTime = millis() + 300; buzzerState++; break;
      default: noTone(BUZZER_PIN); buzzerType = 0; break;
    }
  } else if (buzzerType == 3) { // Intrusion Alarm (Loops)
    if (buzzerState == 1) {
      tone(BUZZER_PIN, 3000); buzzerNextTime = millis() + 120; buzzerState = 2;
    } else {
      tone(BUZZER_PIN, 1500); buzzerNextTime = millis() + 120; buzzerState = 1;
    }
  } else if (buzzerType == 4) { // Denied Chime
    if (buzzerState == 1) {
      tone(BUZZER_PIN, 300); buzzerNextTime = millis() + 300; buzzerState++;
    } else {
      noTone(BUZZER_PIN); buzzerType = 0;
    }
  }
}

'''

text = text[:text.find(old_buzzer_start)] + new_buzzer + text[text.find(old_buzzer_end):]

# Also fix the digitalWrites in checkIR to noTone
text = text.replace('digitalWrite(BUZZER_PIN, LOW);', 'noTone(BUZZER_PIN);')

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)
print('Restored tone()')
