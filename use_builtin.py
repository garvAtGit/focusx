import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

old_client = '''  WiFiClientSecure client;
  client.setInsecure(); // Bypass SSL verification since Vercel root CA rotates 
  
  HTTPClient http;
  if (http.begin(client, API_URL)) {'''

new_client = '''  HTTPClient http;
  // Automatically uses NetworkClientSecure with setInsecure() internally when no CA cert is provided!
  if (http.begin(API_URL)) {'''

text = text.replace(old_client, new_client)

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)

print("Changed to built-in HTTPClient")
