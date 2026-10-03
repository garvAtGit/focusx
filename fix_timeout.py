import sys

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# Fix the outer else block to say TIMEOUT and restore the inner else block
content = content.replace('if (xQueueReceive(authResponseQueue, &res, 6000 / portTICK_PERIOD_MS) == pdPASS) {', 'if (xQueueReceive(authResponseQueue, &res, 8000 / portTICK_PERIOD_MS) == pdPASS) {')

# The outer else block has res.message. We need to replace it with "NETWORK TIMEOUT"
outer_else_bad = '''  } else {
    setLEDsColor(255, 0, 0);
    if (isExit) setRFID2StripColor(255, 0, 0);
    lcd.clear(); lcd.setCursor(0,0); lcd.print(res.message);
    playDeniedChime();
    delay(2000);
    resetToIdle();
  }'''

outer_else_good = '''  } else {
    setLEDsColor(255, 0, 0);
    if (isExit) setRFID2StripColor(255, 0, 0);
    lcd.clear(); lcd.setCursor(0,0); lcd.print("NETWORK TIMEOUT");
    playDeniedChime();
    delay(2000);
    resetToIdle();
  }'''

content = content.replace(outer_else_bad, outer_else_good)

with open(file_path, 'w') as f:
    f.write(content)
