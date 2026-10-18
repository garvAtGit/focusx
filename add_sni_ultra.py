import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\ultrasonic_node\ultrasonic_node.ino', 'r', encoding='utf-8') as f:
    text = f.read()

old_client = '''  WiFiClientSecure client;
  client.setInsecure();
  
  HTTPClient http;
  if (http.begin(client, API_URL)) {'''

new_client = '''  WiFiClientSecure client;
  client.setInsecure();
  client.setServerName("www.focusx.in");
  
  HTTPClient http;
  if (http.begin(client, API_URL)) {'''

text = text.replace(old_client, new_client)

with open(r'C:\Users\thees\Compound\Desktop\Library Near\ultrasonic_node\ultrasonic_node.ino', 'w', encoding='utf-8') as f:
    f.write(text)

print("Added SNI server name to ultrasonic")
