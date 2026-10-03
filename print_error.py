import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# Make the worker pass back the exact HTTP code and message so we can see it on the LCD
old_worker = '''            if (httpCode >= 200 && httpCode < 300) {
              String responseBody = http.getString();
              StaticJsonDocument<512> resDoc;
              DeserializationError err = deserializeJson(resDoc, responseBody);
              if (!err && resDoc.containsKey("status")) {
                String status = resDoc["status"];
                if (status == "APPROVED" || status == "GRANTED" || status == "ALLOW") {
                                  res.resultCode = 1;
                     if (resDoc.containsKey("direction")) {
                         const char* dir = resDoc["direction"];
                         strncpy(res.direction, dir, 15);
                         res.direction[15] = '\\0';
                     } else {
                         strcpy(res.direction, "IN");
                     }
                } else {
                   res.resultCode = 2; // Denied
                }
              }
            } else {
              res.resultCode = 2; // HTTP Error
            }'''

new_worker = '''            if (httpCode >= 200 && httpCode < 300) {
              String responseBody = http.getString();
              StaticJsonDocument<512> resDoc;
              DeserializationError err = deserializeJson(resDoc, responseBody);
              if (!err && resDoc.containsKey("status")) {
                String status = resDoc["status"];
                if (status == "APPROVED" || status == "GRANTED" || status == "ALLOW") {
                                  res.resultCode = 1;
                     if (resDoc.containsKey("direction")) {
                         const char* dir = resDoc["direction"];
                         strncpy(res.direction, dir, 15);
                         res.direction[15] = '\\0';
                     } else {
                         strcpy(res.direction, "IN");
                     }
                } else {
                   res.resultCode = 2; // Denied
                   if (resDoc.containsKey("message")) {
                       strncpy(res.message, resDoc["message"], 63);
                   } else {
                       strcpy(res.message, "ACCESS DENIED");
                   }
                }
              } else {
                  res.resultCode = 2;
                  strcpy(res.message, "JSON PARSE ERR");
              }
            } else {
              res.resultCode = 2; // HTTP Error
              snprintf(res.message, 63, "HTTP ERR: %d", httpCode);
            }'''

content = content.replace(old_worker, new_worker)

# Update doAuth to PRINT res.message instead of hardcoding "ACCESS DENIED"
old_auth = '''      } else { // Denied
        setLEDsColor(255, 0, 0);
        if (isExit) setRFID2StripColor(255, 0, 0);
        lcd.clear(); lcd.setCursor(0,0); lcd.print("ACCESS DENIED");'''

new_auth = '''      } else { // Denied
        setLEDsColor(255, 0, 0);
        if (isExit) setRFID2StripColor(255, 0, 0);
        lcd.clear(); lcd.setCursor(0,0); lcd.print(res.message);'''

content = content.replace(old_auth, new_auth)

with open(file_path, 'w') as f:
    f.write(content)
