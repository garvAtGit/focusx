import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the start of httpWorkerTask
old_start = r'''void httpWorkerTask\(void \*pvParameters\) \{
    AuthRequest req;
    while \(true\) \{'''

new_start = r'''void httpWorkerTask(void *pvParameters) {
    AuthRequest req;
    
    // Persistent clients to prevent socket exhaustion (TIME_WAIT) and heap fragmentation!
    WiFiClientSecure vercelClient;
    vercelClient.setInsecure();
    WiFiClientSecure supabaseClient;
    supabaseClient.setInsecure();
    
    while (true) {'''

content = re.sub(old_start, new_start, content)


# Replace vercel client creation
old_vercel = r'''        if \(WiFi\.status\(\) == WL_CONNECTED\) \{
          WiFiClientSecure client;
          client\.setInsecure\(\); // Standard approach for ESP32
          HTTPClient http;
          if \(http\.begin\(client, API_URL\)\) \{'''

new_vercel = r'''        if (WiFi.status() == WL_CONNECTED) {
          HTTPClient http;
          http.setReuse(true); // Keep-Alive
          if (http.begin(vercelClient, API_URL)) {'''

content = re.sub(old_vercel, new_vercel, content)


# Replace supabase client creation
old_supabase = r'''        if \(WiFi\.status\(\) == WL_CONNECTED && String\(READER_ID\) != "" && \(millis\(\) - lastBLEPollTime > 3000\)\) \{
          lastBLEPollTime = millis\(\);
          WiFiClientSecure client;
          client\.setInsecure\(\);
          HTTPClient http;'''

new_supabase = r'''        if (WiFi.status() == WL_CONNECTED && String(READER_ID) != "" && (millis() - lastBLEPollTime > 3000)) {
          lastBLEPollTime = millis();
          HTTPClient http;
          http.setReuse(true); // Keep-Alive'''

# Need to replace the supabase http.begin too
content = re.sub(old_supabase, new_supabase, content)

content = content.replace('if (http.begin(client, url)) {', 'if (http.begin(supabaseClient, url)) {')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
