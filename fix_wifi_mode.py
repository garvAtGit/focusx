import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

# Force WIFI_STA mode after WiFiManager finishes
old_wifi_end = '''  } else {
    Serial.println("[WIFI] Connected Successfully!");
  }

  preferences.end();'''

new_wifi_end = '''  } else {
    Serial.println("[WIFI] Connected Successfully!");
  }
  
  // CRITICAL FIX: WiFiManager leaves the ESP32 in AP_STA mode. 
  // We MUST turn off the AP mode to prevent TCP routing bugs and TLS timeouts!
  WiFi.mode(WIFI_STA);

  preferences.end();'''

text = text.replace(old_wifi_end, new_wifi_end)

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)

print("Fixed WiFi mode")
