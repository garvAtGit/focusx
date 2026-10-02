import re

# Update Main ESP32
with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Restore hardcoded API key
text = text.replace('char api_key[128] = "";', 'const char* HARDWARE_API_KEY = "YOUR_VERCEL_RELAY_API_KEY"; // Change this before flashing at the factory!')

# 2. Remove api_key from preferences loading
text = re.sub(r'String savedKey = preferences\.getString\("api_key", ""\);\s*if\(savedKey\.length\(\) > 0\) \{\s*strncpy\(api_key, savedKey\.c_str\(\), sizeof\(api_key\) - 1\);\s*\}', '', text)

# 3. Remove custom_api_key from WiFiManager
text = re.sub(r'WiFiManagerParameter custom_api_key.*?\n', '', text)
text = text.replace('wm.addParameter(&custom_api_key);', '')

# 4. Remove preferences saving for api_key
text = text.replace('preferences.putString("api_key", custom_api_key.getValue());', '')
text = text.replace('strncpy(api_key, custom_api_key.getValue(), sizeof(api_key) - 1);', '')

# 5. Fix references back to HARDWARE_API_KEY
text = text.replace('String("Bearer ") + String(api_key)', 'String("Bearer ") + HARDWARE_API_KEY')
text = text.replace('String("Bearer ") + api_key', 'String("Bearer ") + HARDWARE_API_KEY')

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)


# Update Ultrasonic Node
with open(r'C:\Users\thees\Compound\Desktop\Library Near\ultrasonic_node\ultrasonic_node.ino', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('char api_key[128] = "";', 'const char* HARDWARE_API_KEY = "YOUR_VERCEL_RELAY_API_KEY";')
text = re.sub(r'String savedKey = preferences\.getString\("api_key", ""\);\s*if\(savedKey\.length\(\) > 0\) \{\s*strncpy\(api_key, savedKey\.c_str\(\), sizeof\(api_key\) - 1\);\s*\}', '', text)
text = re.sub(r'WiFiManagerParameter custom_api_key.*?\n', '', text)
text = text.replace('wm.addParameter(&custom_api_key);', '')
text = text.replace('preferences.putString("api_key", custom_api_key.getValue());', '')
text = text.replace('strncpy(api_key, custom_api_key.getValue(), sizeof(api_key) - 1);', '')
text = text.replace('String("Bearer ") + String(api_key)', 'String("Bearer ") + HARDWARE_API_KEY')

with open(r'C:\Users\thees\Compound\Desktop\Library Near\ultrasonic_node\ultrasonic_node.ino', 'w', encoding='utf-8') as f:
    f.write(text)

print("Removed API Key from Captive Portal")
