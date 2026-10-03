import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# Replace include
content = content.replace('#include <Adafruit_NeoPixel.h>\n', '#include <FastLED.h>\n')

# Replace initialization
content = re.sub(r'Adafruit_NeoPixel ring = Adafruit_NeoPixel\(12, LED_PIN, NEO_GRB \+ NEO_KHZ800\);', 'CRGB leds[12];', content)

# In setup():
content = content.replace('  ring.begin();\n  ring.show();', '  FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, 12);\n  FastLED.show();')

# Replace setAlarmLEDs function completely!
new_leds_func = """void setAlarmLEDs(bool accessGranted) {
  if (accessGranted) {
    for (int i = 0; i < 12; i++) leds[i] = CRGB::Green;
    FastLED.show();
    delay(1000);
    for (int i = 0; i < 12; i++) leds[i] = CRGB::Black;
    FastLED.show();
  } else {
    for (int j = 0; j < 3; j++) {
      for (int i = 0; i < 12; i++) leds[i] = CRGB::Red;
      FastLED.show();
      delay(300);
      for (int i = 0; i < 12; i++) leds[i] = CRGB::Black;
      FastLED.show();
      delay(300);
    }
  }
}"""
content = re.sub(r'void setAlarmLEDs\(bool accessGranted\) \{.*?\n\}', new_leds_func, content, flags=re.DOTALL)

with open(file_path, 'w') as f:
    f.write(content)
