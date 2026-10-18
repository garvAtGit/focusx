import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# Replace setLEDsColor
func3 = """void setLEDsColor(uint8_t r, uint8_t g, uint8_t b) {
  for (int i = 0; i < NUM_LEDS; i++) strip[i] = CRGB(r, g, b);
  FastLED.show();
}"""
content = re.sub(r'void setLEDsColor\(uint8_t r, uint8_t g, uint8_t b\) \{.*?\n\}', func3, content, flags=re.DOTALL)

# Replace setRFID2StripColor
func4 = """void setRFID2StripColor(uint8_t r, uint8_t g, uint8_t b) {
  for (int i = 0; i < RFID2_NUM_LEDS; i++) rfid2Strip[i] = CRGB(r, g, b);
  FastLED.show();
}"""
content = re.sub(r'void setRFID2StripColor\(uint8_t r, uint8_t g, uint8_t b\) \{.*?\n\}', func4, content, flags=re.DOTALL)

with open(file_path, 'w') as f:
    f.write(content)
