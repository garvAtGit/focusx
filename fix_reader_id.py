
import re

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r") as f:
    text = f.read()

target = "readerId = WiFi.macAddress();"
replacement = "readerId = \"87b99b2c-90fd-11e9-bc42-526af7764f64:1:1\";"

text = text.replace(target, replacement)

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w") as f:
    f.write(text)
print("Restored hardcoded readerId to match APK!")

