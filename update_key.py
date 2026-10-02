import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('const char* HARDWARE_API_KEY = "YOUR_VERCEL_RELAY_API_KEY";', 'const char* HARDWARE_API_KEY = "my_secret_library_door_key_123";')

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated API key")
