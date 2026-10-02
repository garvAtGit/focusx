import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add AsyncUDP include
if 'AsyncUDP.h' not in text:
    text = text.replace('#include <WiFi.h>', '#include <WiFi.h>\n#include <AsyncUDP.h>')

# 2. Add global AsyncUDP object
if 'AsyncUDP udp;' not in text:
    text = text.replace('bool pn532Available = false;', 'bool pn532Available = false;\nAsyncUDP udp;')

# 3. In setup(), add UDP listener
setup_end = '  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);\n  Serial.println("[WIFI] Connecting asynchronously...");'
new_setup_end = '''  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.println("[WIFI] Connecting asynchronously...");
  
  if(udp.listen(8888)) {
    Serial.println("[UDP] Listening on port 8888 for Motion Alerts");
    udp.onPacket([](AsyncUDPPacket packet) {
      String msg = packet.readString();
      if (msg == "MOTION_DETECTED") {
        Serial.println("[UDP] Motion Alert Received!");
        triggerBuzzer(3); // Sound the intrusion alarm
        updateLCD("MOTION ALARM!", "SENSOR TRIPPED");
      }
    });
  }'''
text = text.replace(setup_end, new_setup_end)

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)
print('Added UDP listener to Main ESP32')
