import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add WiFiManager Include
if 'WiFiManager.h' not in text:
    text = text.replace('#include <WiFi.h>', '#include <WiFi.h>\n#include <WiFiManager.h>')

# 2. Remove Hardcoded Secrets
old_secrets = '''// =================================================
// CONFIGURATION & SECRETS
// =================================================
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* API_URL = "https://www.focusx.in/api/hardware/scan";

// CRITICAL TODO FOR PRODUCTION:
// Provision hardware securely via NVS or Secure Element. 
// Do NOT commit actual production keys to source control.
const char* HARDWARE_API_KEY = "YOUR_HARDWARE_API_KEY";
const char* READER_ID = "ESP32_MAIN_DOOR"; '''

new_secrets = '''// =================================================
// CONFIGURATION
// =================================================
const char* API_URL = "https://www.focusx.in/api/hardware/scan";

char api_key[128] = "";
String macAddress = "";'''
text = text.replace(old_secrets, new_secrets)

# 3. Replace HARDWARE_API_KEY with api_key
text = text.replace('HARDWARE_API_KEY', 'api_key')

# 4. Replace READER_ID with macAddress.c_str()
text = text.replace('READER_ID', 'macAddress.c_str()')

# 5. Modify setup() for WiFiManager
old_wifi_init = '''  // 7. WIFI (Async Init)
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
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

new_wifi_init = '''  // 7. WIFI & PROVISIONING (WiFiManager)
  preferences.begin("focusx_main", false);
  String savedKey = preferences.getString("api_key", "");
  if(savedKey.length() > 0) {
      strncpy(api_key, savedKey.c_str(), sizeof(api_key) - 1);
  }

  updateLCD("WIFI SETUP", "CONNECTING...");
  
  WiFiManager wm;
  WiFiManagerParameter custom_api_key("api_key", "Library API Key", api_key, 128);
  wm.addParameter(&custom_api_key);
  
  // Timeout after 60 seconds so the door doesn't stay locked offline!
  wm.setConfigPortalTimeout(60); 

  if (!wm.autoConnect("FocusX-Main-Door")) {
    Serial.println("[WIFI] Failed to connect or timeout. Proceeding Offline!");
    updateLCD("WIFI OFFLINE", "LOCAL MODE ONLY");
    delay(2000);
  } else {
    Serial.println("[WIFI] Connected Successfully!");
  }

  // Save updated preferences
  preferences.putString("api_key", custom_api_key.getValue());
  strncpy(api_key, custom_api_key.getValue(), sizeof(api_key) - 1);
  preferences.end();

  // Use MAC as Reader ID
  macAddress = WiFi.macAddress();
  Serial.println("[SYSTEM] Reader ID / MAC: " + macAddress);
  
  // Start UDP Listener
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
text = text.replace(old_wifi_init, new_wifi_init)

# 6. Add Hardware Reset Block to start of setup
hardware_reset_block = '''
  // Hardware Reset: Hold BOOT (GPIO 0) for 3s to wipe WiFi
  pinMode(0, INPUT_PULLUP);
  Serial.println("Hold BOOT button (GPIO 0) for 3s to reset WiFi...");
  delay(3000);
  if (digitalRead(0) == LOW) {
    Serial.println("Resetting WiFi & Preferences!");
    WiFiManager wm;
    wm.resetSettings();
    preferences.begin("focusx_main", false);
    preferences.clear();
    preferences.end();
    ESP.restart();
  }
'''
text = text.replace('Serial.begin(115200);', 'Serial.begin(115200);' + hardware_reset_block)


with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)
print("WiFiManager injected")
