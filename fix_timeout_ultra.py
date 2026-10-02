import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\ultrasonic_node\ultrasonic_node.ino', 'r', encoding='utf-8') as f:
    text = f.read()

old_http = '''  HTTPClient http;
  if (http.begin(API_URL)) {'''

new_http = '''  HTTPClient http;
  http.setConnectTimeout(15000);
  http.setTimeout(15000);
  if (http.begin(API_URL)) {'''

text = text.replace(old_http, new_http)

with open(r'C:\Users\thees\Compound\Desktop\Library Near\ultrasonic_node\ultrasonic_node.ino', 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated timeout for ultrasonic")
