import re

with open('current.ino', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Remove httpWorkerTask completely
start_marker = '// =================================================\n// BACKGROUND HTTP WORKER TASK (TLS ENABLED)\n// ================================================='
end_marker = 'void startAuthorization(String payload, String scanType) {'

start_idx = text.find(start_marker)
end_idx = text.find(end_marker)

new_performScan = '''// =================================================
// SYNCHRONOUS HTTP SCAN
// =================================================
AuthResponse performScan(AuthRequest req) {
  AuthResponse res;
  res.resultCode = 3; 
  strncpy(res.message, "SYSTEM ERROR", sizeof(res.message)-1);
  res.message[sizeof(res.message)-1] = '\\0';
  
  strncpy(res.direction, "", sizeof(res.direction)-1);
  res.direction[sizeof(res.direction)-1] = '\\0';

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Error: WiFi not connected");
    return res;
  }

  WiFiClientSecure client;
  client.setCACert(rootCACertificate); 
  
  HTTPClient http;
  if (http.begin(client, API_URL)) {
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", String("Bearer ") + HARDWARE_API_KEY);
    http.setTimeout(5000);

    StaticJsonDocument<256> reqDoc;
    reqDoc["eventId"] = req.eventId;
    reqDoc["readerId"] = READER_ID;
    reqDoc["scanType"] = req.scanType;
    reqDoc["payload"] = req.payload;
    
    String requestBody;
    serializeJson(reqDoc, requestBody);

    int httpCode = http.POST(requestBody);
    Serial.printf("[HTTP] Code: %d\\n", httpCode);

    if (httpCode > 0) {
      if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) {
        String responseBody = http.getString();
        StaticJsonDocument<512> resDoc;
        DeserializationError error = deserializeJson(resDoc, responseBody);
        
        if (!error && resDoc.containsKey("status")) {
            String status = resDoc["status"]; 
            String dir = resDoc.containsKey("direction") ? resDoc["direction"].as<String>() : "";
            String msg = resDoc.containsKey("message") ? resDoc["message"].as<String>() : "";
            
            strncpy(res.direction, dir.c_str(), sizeof(res.direction)-1);
            res.direction[sizeof(res.direction)-1] = '\\0';
            
            strncpy(res.message, msg.c_str(), sizeof(res.message)-1);
            res.message[sizeof(res.message)-1] = '\\0';

            if (status == "ALLOW") {
              res.resultCode = 1;
            } else if (status == "DENY" || status == "DENIED") {
              res.resultCode = 2;
            } else {
              res.resultCode = 3;
            }
        }
      } else if (httpCode >= 400 && httpCode < 500) {
        Serial.println("[HTTP] 4xx Client Error. Denying access.");
        String payload = http.getString();
        res.resultCode = 2; // DENY
        StaticJsonDocument<256> resDoc;
        if (!deserializeJson(resDoc, payload) && resDoc.containsKey("message")) {
           strncpy(res.message, resDoc["message"], sizeof(res.message)-1);
        } else {
           strncpy(res.message, "INVALID REQUEST", sizeof(res.message)-1);
        }
      } else {
        Serial.println("[HTTP] Server Error (5xx). Triggering offline cache and reboot...");
        res.resultCode = 3;
      }
    } else {
      Serial.printf("[HTTP] POST failed, error: %s\\n", http.errorToString(httpCode).c_str());
      res.resultCode = 3;
    }
    http.end();
  }
  return res;
}

'''

text = text[:start_idx] + new_performScan + text[end_idx:]

# Also fix startAuthorization which still has authRequestQueue
text = text.replace('  if (xQueueSend(authRequestQueue, &req, 0) == pdPASS) {', '  if (true) {')

# Restore AuthRequest activeReq globally
text = text.replace('QueueHandle_t authResponseQueue;', 'AuthRequest activeReq;')

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)
print('Fixed compilation errors')
