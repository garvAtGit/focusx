import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

old_client = '''  WiFiClientSecure client;
  client.setInsecure(); // Bypass SSL verification since Vercel root CA rotates 
  // CRITICAL: When using custom WiFiClientSecure with setInsecure, 
  // we MUST manually set the SNI host, otherwise Vercel instantly refuses the connection!
  client.setServerName("www.focusx.in"); 
  
  HTTPClient http;
  if (http.begin(client, API_URL)) {'''

new_client = '''  WiFiClientSecure client;
  client.setInsecure(); // Bypass SSL verification since Vercel root CA rotates 
  
  HTTPClient http;
  if (http.begin(client, API_URL)) {'''

text = text.replace(old_client, new_client)

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)

print("Reverted SNI")
