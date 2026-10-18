import sys

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

start_str = '  lcd.clear(); lcd.setCursor(0,0); lcd.print("CHECKING CLAIM");'
end_str = '  preferences.end();'

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_setup = '''  lcd.clear(); lcd.setCursor(0,0); lcd.print("CHECKING CLAIM");
    
  bool isClaimed = false;
  
  // 1. Check if already claimed
  {
    WiFiClientSecure client; 
    client.setInsecure(); 
    HTTPClient http;
    if (http.begin(client, "https://www.focusx.in/api/hardware/check-pin")) {
      http.addHeader("Content-Type", "application/json");
      int code = http.POST("{\\"mac\\":\\"" + String(READER_ID) + "\\"}");
      if (code == 200) {
        String response = http.getString();
        if (response.indexOf("\\"claimed\\":true") != -1 || response.indexOf("\\"claimed\\": true") != -1) {
          isClaimed = true;
        }
      }
      http.end();
    }
  }
  
  if (!isClaimed) {
    // Generate PIN
    String pin = String(random(100000, 999999));
    
    // 2. Register PIN
    {
      WiFiClientSecure client; 
      client.setInsecure(); 
      HTTPClient http;
      if (http.begin(client, "https://www.focusx.in/api/hardware/register-pin")) {
        http.addHeader("Content-Type", "application/json");
        http.POST("{\\"pin\\":\\"" + pin + "\\",\\"mac\\":\\"" + String(READER_ID) + "\\",\\"readerId\\":\\"" + String(READER_ID) + "\\"}");
        http.end();
      }
    }
    
    lcd.clear(); lcd.setCursor(0,0); lcd.print("CLAIM DEVICE PIN");
    lcd.setCursor(0,1); lcd.print(pin);
    
    // 3. Poll until claimed
    while (!isClaimed) {
      delay(3000);
      {
        WiFiClientSecure client; 
        client.setInsecure(); 
        HTTPClient http;
        if (http.begin(client, "https://www.focusx.in/api/hardware/check-pin?pin=" + pin)) {
          int code = http.GET();
          if (code == 200) {
            String response = http.getString();
            if (response.indexOf("\\"isClaimed\\":true") != -1 || response.indexOf("\\"isClaimed\\": true") != -1) {
              isClaimed = true;
            }
          }
          http.end();
        }
      }
    }
    
    lcd.clear(); lcd.setCursor(0,0); lcd.print("DEVICE CLAIMED!");
    delay(3000);
    
    // Reboot after claiming to cleanly reset memory
    ESP.restart();
  }
'''
    content = content[:start_idx] + new_setup + content[end_idx:]
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
else:
    print("Could not find bounds")
