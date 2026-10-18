import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

old_http = '''  HTTPClient http;
  // Increase timeout to 15 seconds because BLE advertising shares the 2.4GHz radio 
  // and severely delays TLS handshakes!
  http.setConnectTimeout(15000);
  http.setTimeout(15000);
  // Automatically uses NetworkClientSecure with setInsecure() internally when no CA cert is provided!
  if (http.begin(API_URL)) {'''

new_http = '''  Serial.printf("[HTTP] Free Heap before request: %u bytes\\n", ESP.getFreeHeap());
  
  HTTPClient http;
  // Increase timeout to 15 seconds because BLE advertising shares the 2.4GHz radio 
  // and severely delays TLS handshakes!
  http.setConnectTimeout(15000);
  http.setTimeout(15000);
  // Automatically uses NetworkClientSecure with setInsecure() internally when no CA cert is provided!
  if (http.begin(API_URL)) {'''

text = text.replace(old_http, new_http)

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)

print("Added heap check")
