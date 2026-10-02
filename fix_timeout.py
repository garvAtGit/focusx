import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

# Increase HTTP timeout
old_http = '''  HTTPClient http;
  // Automatically uses NetworkClientSecure with setInsecure() internally when no CA cert is provided!
  if (http.begin(API_URL)) {'''

new_http = '''  HTTPClient http;
  // Increase timeout to 15 seconds because BLE advertising shares the 2.4GHz radio 
  // and severely delays TLS handshakes!
  http.setConnectTimeout(15000);
  http.setTimeout(15000);
  // Automatically uses NetworkClientSecure with setInsecure() internally when no CA cert is provided!
  if (http.begin(API_URL)) {'''

text = text.replace(old_http, new_http)

# Reduce BLE interval
old_ble = '''static esp_ble_adv_params_t adv_params = {
  .adv_int_min       = 0x20,
  .adv_int_max       = 0x40,'''

new_ble = '''static esp_ble_adv_params_t adv_params = {
  // Increased interval to 100ms (0x0100 * 0.625ms) to give WiFi time to perform TLS handshakes!
  .adv_int_min       = 0x0100,
  .adv_int_max       = 0x0120,'''

text = text.replace(old_ble, new_ble)

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated timeouts and BLE intervals")
