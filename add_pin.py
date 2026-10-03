import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# 1. Remove WiFiManager params
setup_start = content.find('  // FORCE PORTAL IF API KEY OR READER ID IS MISSING')
if setup_start != -1:
    old_wm_block = '''  WiFiManager wm;
  wm.setConnectTimeout(30);
  WiFiManagerParameter custom_api_key("apikey", "Hardware API Key", HARDWARE_API_KEY, 64);
  WiFiManagerParameter custom_reader_id("readerid", "Reader ID", READER_ID.c_str(), 64);
  wm.addParameter(&custom_api_key);
  wm.addParameter(&custom_reader_id);
  
  lcd.setCursor(0,1); lcd.print("CONNECTING WIFI");
  
  // FORCE PORTAL IF API KEY OR READER ID IS MISSING
  if (String(HARDWARE_API_KEY) == "" || READER_ID == "") {
    lcd.clear(); lcd.setCursor(0,0); lcd.print("SETUP REQUIRED");
    lcd.setCursor(0,1); lcd.print("Join FocusX AP");
    wm.startConfigPortal("FocusX Scanner");
  } else {
    if (!wm.autoConnect("FocusX Scanner")) {
      Serial.println("Failed to connect and hit timeout");
      ESP.restart();
    }
  }
  
  String newKey = custom_api_key.getValue();
  String newReaderId = custom_reader_id.getValue();
  if (newKey != "" && newKey != String(HARDWARE_API_KEY)) {
    preferences.putString("apikey", newKey);
    strncpy(HARDWARE_API_KEY, newKey.c_str(), sizeof(HARDWARE_API_KEY));
  }
  if (newReaderId != "" && newReaderId != READER_ID) {
    preferences.putString("readerid", newReaderId);
    READER_ID = newReaderId;
  }
  preferences.end();'''

    new_wm_block = '''  WiFiManager wm;
  wm.setConnectTimeout(30);
  
  lcd.setCursor(0,1); lcd.print("CONNECTING WIFI");
  if (!wm.autoConnect("FocusX Scanner")) {
    Serial.println("Failed to connect and hit timeout");
    ESP.restart();
  }
  
  // Set Reader ID to MAC Address automatically
  READER_ID = WiFi.macAddress();
  READER_ID.replace(":", "");
  
  // PIN-based setup logic
  lcd.clear(); lcd.setCursor(0,0); lcd.print("CHECKING CLAIM");
  
  bool isClaimed = false;
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  
  // Check if already claimed
  if (http.begin(client, String("https://www.focusx.in/api/hardware/check-pin"))) {
    http.addHeader("Content-Type", "application/json");
    int code = http.POST("{\\"mac\\":\\"" + READER_ID + "\\"}");
    if (code == 200) {
      String response = http.getString();
      if (response.indexOf("\\"claimed\\":true") != -1 || response.indexOf("\\"claimed\\": true") != -1) {
        isClaimed = true;
      }
    }
    http.end();
  }
  
  if (!isClaimed) {
    // Generate PIN
    String pin = String(random(100000, 999999));
    
    // Register PIN
    if (http.begin(client, String("https://www.focusx.in/api/hardware/register-pin"))) {
      http.addHeader("Content-Type", "application/json");
      http.POST("{\\"pin\\":\\"" + pin + "\\",\\"mac\\":\\"" + READER_ID + "\\",\\"readerId\\":\\"" + READER_ID + "\\"}");
      http.end();
    }
    
    // Display PIN and poll until claimed
    lcd.clear();
    lcd.setCursor(0,0); lcd.print("CLAIM DEVICE PIN");
    lcd.setCursor(0,1); lcd.print(pin);
    
    while (!isClaimed) {
      delay(3000);
      if (http.begin(client, String("https://www.focusx.in/api/hardware/check-pin?pin=") + pin)) {
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
    lcd.clear(); lcd.print("DEVICE CLAIMED!");
    delay(2000);
  }
  preferences.end();'''
    
    content = content.replace(old_wm_block, new_wm_block)

with open(file_path, 'w') as f:
    f.write(content)
