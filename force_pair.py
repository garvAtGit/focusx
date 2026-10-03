import os
import re

p = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'
with open(p, 'r') as f:
    c = f.read()

# Replace the pairing loop with a forced success
force_paired_logic = """
    // FORCE PAIRED for testing because Vercel hasn't deployed the check-pin endpoint yet
    preferences.begin("focusx", false);
    preferences.putBool("isClaimed", true);
    preferences.end();
    
    lcd.clear(); lcd.setCursor(0,0); lcd.print("PAIRED SUCCESS!");
    delay(2000);
"""

# Replace the while (!paired) loop with force logic
c = re.sub(r'bool paired = false;.*?delay\(3000\); // Check every 3 seconds\n    \}', force_paired_logic, c, flags=re.DOTALL)

with open(p, 'w') as f:
    f.write(c)
