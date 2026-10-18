import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# Make the worker pass back the exact HTTP code and message so we can see it on the LCD
# We'll do a robust regex replace for the worker code.

worker_regex = re.compile(r'if \(httpCode >= 200 && httpCode < 300\).*?} else \{\s*res\.resultCode = 2; // HTTP Error\s*\}', re.DOTALL)

new_worker = '''if (httpCode >= 200 && httpCode < 300) {
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
              snprintf(res.message, 63, "HTTP ERR %d", httpCode);
            }'''

if worker_regex.search(content):
    content = worker_regex.sub(new_worker, content)
else:
    print("Could not find worker block!")

# Replace ACCESS DENIED hardcode
auth_regex = re.compile(r'lcd\.clear\(\); lcd\.setCursor\(0,0\); lcd\.print\("ACCESS DENIED"\);')
if auth_regex.search(content):
    content = auth_regex.sub('lcd.clear(); lcd.setCursor(0,0); lcd.print(res.message);', content)
else:
    print("Could not find auth print block!")

with open(file_path, 'w') as f:
    f.write(content)
