import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

# Pass error string in res.message
old_http_fail = '''    } else {
      Serial.printf("[HTTP] POST failed, error: %s\\n", http.errorToString(httpCode).c_str());
      res.resultCode = 3;
    }'''

new_http_fail = '''    } else {
      String errStr = http.errorToString(httpCode);
      Serial.printf("[HTTP] POST failed, error: %s\\n", errStr.c_str());
      res.resultCode = 3;
      strncpy(res.message, errStr.c_str(), sizeof(res.message)-1);
    }'''

text = text.replace(old_http_fail, new_http_fail)

old_print_error = '''    case 3:
      updateLCD("NETWORK ERROR", "TAP TO RETRY");
      delay(2000);
      break;'''

new_print_error = '''    case 3:
      if (strlen(res.message) > 0) {
        updateLCD("NET ERR:", res.message);
      } else {
        updateLCD("NETWORK ERROR", "TAP TO RETRY");
      }
      delay(3000);
      break;'''

text = text.replace(old_print_error, new_print_error)

# Also let's double check if TLS needs to be completely dropped for debugging!
# Maybe we can use http:// instead of https:// ? NO, Vercel redirects to HTTPS.

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated error printing")
