import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

content = content.replace('#include <Adafruit_NeoPixel.h>', '#include <FastLED.h>')

content = re.sub(r'Adafruit_NeoPixel strip = Adafruit_NeoPixel\(NUM_LEDS, LED_PIN, NEO_GRB \+ NEO_KHZ800\);', 'CRGB strip[NUM_LEDS];', content)
content = re.sub(r'Adafruit_NeoPixel rfid2Strip = Adafruit_NeoPixel\(RFID2_NUM_LEDS, RFID2_LED_PIN, NEO_GRB \+ NEO_KHZ800\);', 'CRGB rfid2Strip[RFID2_NUM_LEDS];', content)

# Setup
content = content.replace('strip.begin(); strip.show(); strip.setBrightness(100);', 'FastLED.addLeds<WS2812B, LED_PIN, GRB>(strip, NUM_LEDS);\n  FastLED.setBrightness(100);\n  FastLED.show();')
content = content.replace('rfid2Strip.begin(); rfid2Strip.show(); rfid2Strip.setBrightness(100);', 'FastLED.addLeds<WS2812B, RFID2_LED_PIN, GRB>(rfid2Strip, RFID2_NUM_LEDS);\n  FastLED.setBrightness(100);\n  FastLED.show();')

# strip.Color -> CRGB
content = re.sub(r'strip\.Color\((\d+),\s*(\d+),\s*(\d+)\)', r'CRGB(\1, \2, \3)', content)
content = re.sub(r'rfid2Strip\.Color\((\d+),\s*(\d+),\s*(\d+)\)', r'CRGB(\1, \2, \3)', content)

# setPixelColor(i, color) -> strip[i] = color
content = re.sub(r'strip\.setPixelColor\(([^,]+),\s*([^)]+)\)', r'strip[\1] = \2', content)
content = re.sub(r'rfid2Strip\.setPixelColor\(([^,]+),\s*([^)]+)\)', r'rfid2Strip[\1] = \2', content)

# strip.show() -> FastLED.show()
content = content.replace('strip.show();', 'FastLED.show();')
content = content.replace('rfid2Strip.show();', 'FastLED.show();')

with open(file_path, 'w') as f:
    f.write(content)
