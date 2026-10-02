
import re

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r") as f:
    text = f.read()

# 1. Revert API_URL
text = text.replace("""const char* API_URL = "http://76.76.21.21/api/hardware/scan"; // VERCEL IP TEST""", """const char* API_URL = "https://www.focusx.in/api/hardware/scan";""")
text = text.replace("""const char* STATUS_URL = "http://www.focusx.in/api/hardware/status";""", """const char* STATUS_URL = "https://www.focusx.in/api/hardware/status";""")

# 2. Revert announce URL
announce_old = """  while (!isClaimed) {
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      if (http.begin("http://76.76.21.21/api/hardware/announce")) {
        http.addHeader("Content-Type", "application/json");
        http.addHeader("Host", "www.focusx.in");"""

announce_new = """  while (!isClaimed) {
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      if (http.begin("https://www.focusx.in/api/hardware/announce", rootCACertificate)) {
        http.addHeader("Content-Type", "application/json");"""

text = text.replace(announce_old, announce_new)

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w") as f:
    f.write(text)
print("Reverted to HTTPS!")

