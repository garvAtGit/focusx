import sys

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# Remove the FORCE PAIRED bypass blocks
content = content.replace('''
    // FORCE PAIRED for testing because Vercel hasn't deployed the check-pin endpoint yet
    preferences.begin("focusx", false);
    preferences.putBool("isClaimed", true);
    preferences.end();
    
    lcd.clear(); lcd.setCursor(0,0); lcd.print("PAIRED SUCCESS!");
    delay(2000);

    
    preferences.begin("focusx", false);
    preferences.putBool("isClaimed", true);
    preferences.end();
    
    lcd.clear(); lcd.setCursor(0,0); lcd.print("PAIRED SUCCESS!");
    delay(2000);
''', '')

with open(file_path, 'w') as f:
    f.write(content)
