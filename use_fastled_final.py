import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

content = re.sub(r'Adafruit_NeoPixel strip\(NUM_LEDS, LED_PIN, NEO_GRB \+ NEO_KHZ800\);', 'CRGB strip[NUM_LEDS];', content)
content = re.sub(r'Adafruit_NeoPixel rfid2Strip\(RFID2_NUM_LEDS, RFID2_LED_PIN, NEO_GRB \+ NEO_KHZ800\);', 'CRGB rfid2Strip[RFID2_NUM_LEDS];', content)
content = content.replace('uint32_t countdownColor', 'CRGB countdownColor')

with open(file_path, 'w') as f:
    f.write(content)
