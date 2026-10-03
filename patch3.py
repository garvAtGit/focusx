import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Regular expression that handles varying whitespace, newlines, and the missing/extra brackets
worker_regex = re.compile(r'if \s*\(httpCode\s*>=\s*200\s*&&\s*httpCode\s*<\s*300\).*?res\.resultCode\s*=\s*2;\s*//\s*HTTP Error\s*\}', re.DOTALL)

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

if worker_regex.search(content):
    content = worker_regex.sub(new_worker, content)
else:
    print("STILL FAILED TO FIND REGEX")

content = re.sub(r'lcd\.clear\(\);\s*lcd\.setCursor\(0,0\);\s*lcd\.print\("ACCESS DENIED"\);', 'lcd.clear(); lcd.setCursor(0,0); lcd.print(res.message);', content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
