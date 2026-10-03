import sys

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the start of the function
target_str = 'void httpWorkerTask(void *pvParameters) {'
replacement_str = '''void httpWorkerTask(void *pvParameters) {
  WiFiClientSecure vercelClient;
  vercelClient.setInsecure();
  WiFiClientSecure supabaseClient;
  supabaseClient.setInsecure();
'''
content = content.replace(target_str, replacement_str)

# Clean up any residual 'WiFiClientSecure client;' lines
content = content.replace('WiFiClientSecure client;', '')
content = content.replace('client.setInsecure();', '')
# Ensurehttp.begin uses the correct clients
content = content.replace('http.begin(client, API_URL)', 'http.begin(vercelClient, API_URL)')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
