
import re
with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r") as f:
    text = f.read()

target = """  WiFi.mode(WIFI_STA);
  WiFiManager wm;
  wm.setCleanConnect(true); 
  wm.setConnectTimeout(15);
  updateLCD("WIFI SETUP", "CONNECTING...");
  
  if (!wm.autoConnect("FocusX-Setup")) {
    Serial.println("Failed to connect and hit timeout");
    updateLCD("WIFI SETUP", "FAILED");
    delay(3000);
    ESP.restart();
  }

  Serial.println("[WIFI] Connected.");
  updateLCD("WIFI SETUP", "CONNECTED");
  delay(1000);"""

replacement = """  WiFi.mode(WIFI_STA);
  updateLCD("WIFI", "ROOM 402 4G");
  WiFi.begin("ROOM 402 4G", "12345678");
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(1000);
    attempts++;
  }
  
  if (WiFi.status() != WL_CONNECTED) {
    updateLCD("WIFI ERROR", "CHECK 2.4GHz");
    delay(5000);
    ESP.restart();
  }
  
  updateLCD("WIFI SETUP", "CONNECTED");
  delay(1000);"""

text = text.replace(target, replacement)

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w") as f:
    f.write(text)
print("Replaced WiFiManager with hardcoded WiFi")

