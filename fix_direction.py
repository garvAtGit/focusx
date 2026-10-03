import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# 1. Update httpWorkerTask to parse direction
parse_direction = """               res.resultCode = 1;
                   if (resDoc.containsKey("direction")) {
                       const char* dir = resDoc["direction"];
                       strncpy(res.direction, dir, 15);
                       res.direction[15] = '\\0';
                   } else {
                       strcpy(res.direction, "IN");
                   }"""
content = re.sub(r'res\.resultCode = 1;', parse_direction, content, count=1)

# 2. Update doAuth to use res.direction instead of isExit for the UI
doauth_ui = """        if (String(res.direction) == "OUT") {
          setLEDsColor(255, 80, 0);
          setRFID2StripColor(0, 255, 0);
          userIsInside = false;
          lcd.clear(); lcd.setCursor(0,0); lcd.print("GOODBYE!");
          lcd.setCursor(0,1); lcd.print("GATE OPEN");
          playGoodbyeChime();
        } else {
          setLEDsColor(0, 255, 0);
          userIsInside = true;
          lcd.clear(); lcd.setCursor(0,0); lcd.print("WELCOME!");
          lcd.setCursor(0,1); lcd.print("GATE OPEN");
          playWelcomeChime();
        }"""
content = re.sub(r'\s*if\s*\(isExit\)\s*\{\s*setLEDsColor\(255,\s*80,\s*0\);.*?playWelcomeChime\(\);\s*\}', '\n' + doauth_ui, content, flags=re.DOTALL)

with open(file_path, 'w') as f:
    f.write(content)
