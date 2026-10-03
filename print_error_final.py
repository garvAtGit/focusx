import sys

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

start_idx = content.find('            if (httpCode >= 200 && httpCode < 300) {')
end_idx = content.find('            } else {\n              res.resultCode = 2; // HTTP Error\n            }', start_idx) + len('            } else {\n              res.resultCode = 2; // HTTP Error\n            }')

if start_idx != -1 and end_idx > start_idx:
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
                       strcpy(res.message, "SERVER DENIED");
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
    content = content[:start_idx] + new_worker + content[end_idx:]
else:
    print("Failed to find worker block boundaries.")

auth_old = 'lcd.clear(); lcd.setCursor(0,0); lcd.print("ACCESS DENIED");'
auth_new = 'lcd.clear(); lcd.setCursor(0,0); lcd.print(res.message);'
content = content.replace(auth_old, auth_new)

with open(file_path, 'w') as f:
    f.write(content)
