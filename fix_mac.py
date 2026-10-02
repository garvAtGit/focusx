import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix macAddress ordering
text = text.replace('  // Use MAC as Reader ID\n  macAddress = WiFi.macAddress();', '')

text = text.replace('  initBLE();', '  macAddress = WiFi.macAddress();\n  initBLE();')

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)

print("Fixed macAddress assignment")
