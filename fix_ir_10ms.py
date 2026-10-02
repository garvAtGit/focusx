import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    'if (millis() - irDetectStartTime >= 50) { // FIX: Lowered debounce to 50ms to catch fast walkers',
    'if (millis() - irDetectStartTime >= 10) { // FIX: Lowered debounce to 10ms for instant detection'
)

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)
print('Fixed IR debounce to 10ms')
