import re

# Update Main ESP32
with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('client.setCACert(rootCACertificate);', 'client.setInsecure(); // Bypass SSL verification since Vercel root CA rotates')

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)

# Update Ultrasonic Node
with open(r'C:\Users\thees\Compound\Desktop\Library Near\ultrasonic_node\ultrasonic_node.ino', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('client.setCACert(rootCACertificate);', 'client.setInsecure();')

with open(r'C:\Users\thees\Compound\Desktop\Library Near\ultrasonic_node\ultrasonic_node.ino', 'w', encoding='utf-8') as f:
    f.write(text)

print("Changed to setInsecure()")
