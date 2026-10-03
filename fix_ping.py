import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Define getISOTime() if missing
if 'String getISOTime()' not in content:
    content = content.replace('void sendHardwarePing() {', '''String getISOTime() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return "2026-01-01T00:00:00.000Z";
  }
  char timeStringBuff[50];
  strftime(timeStringBuff, sizeof(timeStringBuff), "%Y-%m-%dT%H:%M:%S.000Z", &timeinfo);
  return String(timeStringBuff);
}

void sendHardwarePing() {''')

# 2. Add WiFiClientSecure client; client.setInsecure(); in sendHardwarePing()
content = content.replace('if (http.begin(client, url)) {', 'WiFiClientSecure client; client.setInsecure(); if (http.begin(client, url)) {')

# 3. Clean up any accidental double client declarations
content = content.replace('WiFiClientSecure client; client.setInsecure(); WiFiClientSecure client; client.setInsecure();', 'WiFiClientSecure client; client.setInsecure();')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
