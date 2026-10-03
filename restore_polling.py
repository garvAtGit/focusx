import sys

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

polling_logic = """
      bool success = false;
      while(!success) {
        delay(3000);
        HTTPClient checkHttp;
        checkHttp.begin(client, "https://www.focusx.in/api/hardware/check-pin");
        checkHttp.addHeader("Content-Type", "application/json");
        String checkPayload = "{\\"mac\\":\\"" + READER_ID + "\\"}";
        int checkCode = checkHttp.POST(checkPayload);
        if (checkCode == 200) {
          String res = checkHttp.getString();
          StaticJsonDocument<128> doc;
          deserializeJson(doc, res);
          if (doc["claimed"] == true) {
            success = true;
          }
        }
        checkHttp.end();
      }
      preferences.begin("focusx", false);
      preferences.putBool("isClaimed", true);
      preferences.end();
      lcd.clear(); lcd.setCursor(0,0); lcd.print("PAIRED SUCCESS!");
      delay(2000);
"""

search_str = 'lcd.setCursor(0,1); lcd.print("PIN: " + pin);'
content = content.replace(search_str, search_str + '\n' + polling_logic)

with open(file_path, 'w') as f:
    f.write(content)
