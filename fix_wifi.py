
import re

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r") as f:
    text = f.read()

# Add connection timeout and clean connect to WiFiManager
target = "WiFiManager wm;\n  updateLCD(\"WIFI SETUP\", \"CONNECTING...\");"
replacement = """WiFi.mode(WIFI_STA);
  WiFiManager wm;
  wm.setCleanConnect(true); 
  wm.setConnectTimeout(15);
  updateLCD("WIFI SETUP", "CONNECTING...");"""

text = text.replace(target, replacement)

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w") as f:
    f.write(text)
print("Added WiFi fixes!")

