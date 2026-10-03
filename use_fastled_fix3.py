import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# Replace the specific broken lines
content = re.sub(r'for \(int i = 0; i < NUM_LEDS; i\+\+\) strip\[i\] = reversePattern \? \(i%2==0 \? CRGB\(0,0,255\) : CRGB\(255,0,0\) : \(i%2==0 \? CRGB\(255, 0, 0\):CRGB\(0, 0, 255\)\)\);', 'for (int i = 0; i < NUM_LEDS; i++) strip[i] = reversePattern ? (i%2==0 ? CRGB(0,0,255) : CRGB(255,0,0)) : (i%2==0 ? CRGB(255,0,0) : CRGB(0,0,255));', content)

content = re.sub(r'for \(int i = 0; i < RFID2_NUM_LEDS; i\+\+\) rfid2Strip\[i\] = reversePattern \? \(i%2==0 \? CRGB\(0,0,255\) : CRGB\(255,0,0\) : \(i%2==0 \? CRGB\(255, 0, 0\):CRGB\(0, 0, 255\)\)\);', 'for (int i = 0; i < RFID2_NUM_LEDS; i++) rfid2Strip[i] = reversePattern ? (i%2==0 ? CRGB(0,0,255) : CRGB(255,0,0)) : (i%2==0 ? CRGB(255,0,0) : CRGB(0,0,255));', content)

with open(file_path, 'w') as f:
    f.write(content)
