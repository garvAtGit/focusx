
import re

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r") as f:
    text = f.read()

func = """
AuthResponse performScan(AuthRequest req) {
  AuthResponse res;
  res.resultCode = 3;
  strncpy(res.message, "SERVER ERROR", sizeof(res.message)-1); res.message[sizeof(res.message)-1] = chr(0);
  strncpy(res.direction, "", sizeof(res.direction)-1); res.direction[sizeof(res.direction)-1] = chr(0);

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    if (http.begin(API_URL, rootCACertificate)) {
      http.addHeader("Content-Type", "application/json");
      http.addHeader("Authorization", String("Bearer ") + HARDWARE_API_KEY);
      http.setTimeout(15000);

      StaticJsonDocument<256> reqDoc;
      reqDoc["eventId"] = req.eventId;
      reqDoc["readerId"] = readerId;
      reqDoc["scanType"] = req.scanType;
      reqDoc["payload"] = req.payload;

      String requestBody;
      serializeJson(reqDoc, requestBody);
      int httpCode = http.POST(requestBody);

      if (httpCode >= 200 && httpCode < 300) {
        String responseBody = http.getString();
        StaticJsonDocument<512> resDoc;
        if (!deserializeJson(resDoc, responseBody)) {
          String status = resDoc["status"].as<String>();
          if (resDoc.containsKey("direction")) {
            strncpy(res.direction, resDoc["direction"].as<String>().c_str(), sizeof(res.direction)-1);
            res.direction[sizeof(res.direction)-1] = chr(0);
          }
          if (resDoc.containsKey("message")) {
            strncpy(res.message, resDoc["message"].as<String>().c_str(), sizeof(res.message)-1);
            res.message[sizeof(res.message)-1] = chr(0);
          }
          if (status == "ALLOW") res.resultCode = 1;
          else if (status == "DENY" || status == "DENIED") res.resultCode = 2;
        }
      } else if (httpCode > 0) {
        String errStr = http.errorToString(httpCode);
        snprintf(res.message, sizeof(res.message)-1, "%s", errStr.c_str());
      } else {
        String errStr = http.errorToString(httpCode);
        snprintf(res.message, sizeof(res.message)-1, "%s", errStr.c_str());
      }
      http.end();
    } else {
       strncpy(res.message, "HTTP SETUP FAIL", sizeof(res.message)-1); res.message[sizeof(res.message)-1] = chr(0);
    }
  } else {
    strncpy(res.message, "WIFI DROPPED", sizeof(res.message)-1); res.message[sizeof(res.message)-1] = chr(0);
  }
  return res;
}
"""

text = text.replace("QueueHandle_t authRequestQueue;", "AuthRequest activeReq;")

# Replace startAuthorization
start_old = """    if (xQueueSend(authRequestQueue, &req, 0) == pdPASS) {
      currentState = STATE_AUTHORIZING;
      updateLCD("AUTHORIZING...", "PLEASE WAIT");
    } else {
      Serial.println("[AUTH] Queue full!");
      triggerBuzzer(4);
    }"""
start_new = """    activeReq = req;
    currentState = STATE_AUTHORIZING;
    updateLCD("AUTHORIZING...", "PLEASE WAIT");"""
text = text.replace(start_old, start_new)

# Replace STATE_AUTHORIZING in loop
loop_old = """    case STATE_AUTHORIZING:
      // Awaiting response from FreeRTOS task queue
      AuthResponse res;
      if (xQueueReceive(authResponseQueue, &res, 0) == pdPASS) {
        processAuthResponse(res);
      }
      break;"""
loop_new = """    case STATE_AUTHORIZING:
      {
        AuthResponse res = performScan(activeReq);
        processAuthResponse(res);
      }
      break;"""
text = text.replace(loop_old, loop_new)

# Inject func above startAuthorization
text = text.replace("void startAuthorization(String payload, String scanType) {", func + "\nvoid startAuthorization(String payload, String scanType) {")

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w") as f:
    f.write(text)
print("Synchronous injected!")

