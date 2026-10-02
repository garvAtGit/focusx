import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

# Remove initBLE() from its current position
text = text.replace('  // 5. BLE (Immediate Independent Startup)\n  initBLE();\n\n\n\n', '')

# Insert it AFTER the WiFi block
old_wifi_end = '''  } else {
    Serial.println("[WIFI] Connected Successfully!");
  }

  // Save updated preferences
  
  
  preferences.end();'''

new_wifi_end = '''  } else {
    Serial.println("[WIFI] Connected Successfully!");
  }

  preferences.end();

  // 5. BLE (Start BLE ONLY AFTER WiFi setup completes to prevent radio conflicts)
  initBLE();
'''

text = text.replace(old_wifi_end, new_wifi_end)

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)

print("Moved BLE initialization after WiFi setup.")
