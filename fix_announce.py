
import re

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r") as f:
    text = f.read()

announce_old = """  while (!isClaimed) {
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      if (http.begin("https://www.focusx.in/api/hardware/announce", rootCACertificate)) {
        http.addHeader("Content-Type", "application/json");"""

announce_new = """  while (!isClaimed) {
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      if (http.begin("http://76.76.21.21/api/hardware/announce")) {
        http.addHeader("Content-Type", "application/json");
        http.addHeader("Host", "www.focusx.in");"""

text = text.replace(announce_old, announce_new)

code_old = """        int httpCode = http.POST(payload);
        if (httpCode >= 200 && httpCode < 300) {"""
code_new = """        int httpCode = http.POST(payload);
        Serial.printf("[ANNOUNCE] httpCode: %d\\n", httpCode);
        if (httpCode >= 200 && httpCode < 300) {"""

text = text.replace(code_old, code_new)

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w") as f:
    f.write(text)
print("Fixed announce loop!")

