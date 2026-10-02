import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

old_client = '''  WiFiClientSecure client;
  client.setInsecure(); // Bypass SSL verification since Vercel root CA rotates 
  
  HTTPClient http;
  if (http.begin(client, API_URL)) {'''

new_client = '''  IPAddress resolvedIP;
  if (WiFi.hostByName("www.focusx.in", resolvedIP)) {
    Serial.printf("[DNS] www.focusx.in resolved to: %s\\n", resolvedIP.toString().c_str());
  } else {
    Serial.println("[DNS] ERROR: Failed to resolve www.focusx.in");
  }

  WiFiClientSecure client;
  client.setInsecure(); // Bypass SSL verification since Vercel root CA rotates 
  
  HTTPClient http;
  if (http.begin(client, API_URL)) {'''

text = text.replace(old_client, new_client)

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)

print("Added DNS check")
