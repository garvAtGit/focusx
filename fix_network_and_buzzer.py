import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix 1: Remove setReuse(true)
text = re.sub(r'\s*globalHttp\.setReuse\(true\);\s*', '\n', text)

# Fix 2: Replace tone() with digitalWrite()
text = re.sub(r'tone\(BUZZER_PIN,\s*\d+\)', 'digitalWrite(BUZZER_PIN, HIGH)', text)
text = re.sub(r'noTone\(BUZZER_PIN\)', 'digitalWrite(BUZZER_PIN, LOW)', text)

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)
print('Fixed Buzzer and Network Reuse')
