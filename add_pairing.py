import os
import re

p = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'
with open(p, 'r') as f:
    c = f.read()

pairing_logic = """
  preferences.begin("focusx", false);
  bool isClaimed = preferences.getBool("isClaimed", false);
  preferences.end();

  WiFiManager wm;
  wm.setConnectTimeout(30);

  if (!isClaimed) {
    lcd.clear(); lcd.setCursor(0,0); lcd.print("CONNECT TO WIFI:");
    lcd.setCursor(0,1); lcd.print("FocusX Scanner");
  } else {
    lcd.clear(); lcd.setCursor(0,0); lcd.print("CONNECTING WIFI");
  }

  if (!wm.autoConnect("FocusX Scanner")) {
    Serial.println("Failed to connect and hit timeout");
    ESP.restart();
  }

  if (!isClaimed) {
    lcd.clear(); lcd.setCursor(0,0); lcd.print("GENERATING PIN..");
    
    randomSeed(ESP.getEfuseMac());
    String pin = String(random(100000, 999999));
    
    NetworkClientSecure client; 
    client.setInsecure();
    HTTPClient http;
    http.begin(client, "https://www.focusx.in/api/hardware/register-pin");
    http.addHeader("Content-Type", "application/json");
    String payload = "{\\"pin\\":\\"" + pin + "\\",\\"mac\\":\\"" + READER_ID + "\\",\\"readerId\\":\\"" + READER_ID + "\\"}";
    int httpCode = http.POST(payload);
    http.end();
    
    lcd.clear(); lcd.setCursor(0,0); lcd.print("ENTER ON DASH:");
    lcd.setCursor(0,1); lcd.print("PIN: " + pin);
    
    bool paired = false;
    while (!paired) {
      http.begin(client, "https://www.focusx.in/api/hardware/check-pin?pin=" + pin);
      int code = http.GET();
      if (code == 200) {
        String res = http.getString();
        if (res.indexOf("\\"isClaimed\\":true") > 0) {
          paired = true;
        }
      }
      http.end();
      delay(3000); // Check every 3 seconds
    }
    
    preferences.begin("focusx", false);
    preferences.putBool("isClaimed", true);
    preferences.end();
    
    lcd.clear(); lcd.setCursor(0,0); lcd.print("PAIRED SUCCESS!");
    delay(2000);
  }
"""

c = re.sub(r'preferences\.begin\("focusx", false\);.*?if \(!wm\.autoConnect\("FocusX Scanner"\)\) \{.*?ESP\.restart\(\);\n  \}', pairing_logic, c, flags=re.DOTALL)

with open(p, 'w') as f:
    f.write(c)
