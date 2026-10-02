import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

old_code = '''  // CRITICAL FIX: WiFiManager leaves the ESP32 in AP_STA mode. 
  // We MUST turn off the AP mode to prevent TCP routing bugs and TLS timeouts!
  WiFi.mode(WIFI_STA);'''

new_code = '''  // CRITICAL FIX: WiFiManager leaves the ESP32 in AP_STA mode. 
  // We MUST turn off the AP mode to prevent TCP routing bugs and TLS timeouts!
  // WiFi.mode(WIFI_STA); // Commented out to test if it breaks DNS/TLS!'''

text = text.replace(old_code, new_code)

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)

print("Commented out WiFi.mode(WIFI_STA)")
