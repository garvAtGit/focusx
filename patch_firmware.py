import re

with open("FocusX_Scanner_Firmware_V5_DualRFID/FocusX_Scanner_Firmware_V5_DualRFID.ino", "r") as f:
    code = f.read()

# 1. Add PubSubClient and AuthCredential
add_includes = r"""#include <PubSubClient.h>
struct AuthCredential {
  char uid[40];
  uint32_t validFrom;
  uint32_t validUntil;
};
std::vector<AuthCredential> authSnapshot;
uint32_t currentAuthRevision = 0;
String currentLibraryId = "";
WiFiClient mqttWiFiClient;
PubSubClient mqttClient(mqttWiFiClient);
const char* mqtt_server = "broker.hivemq.com"; // Placeholder
"""
code = code.replace("#include <vector>", "#include <vector>\n" + add_includes)

# 2. Add Offline Sync Logic
offline_logic = r"""
void loadSnapshotFromFlash() {
  File file = LittleFS.open("/snapshot.txt", "r");
  if (!file) return;
  authSnapshot.clear();
  while (file.available()) {
    String line = file.readStringUntil('\n');
    line.trim();
    if (line.startsWith("REV ")) {
      currentAuthRevision = line.substring(4).toInt();
    } else if (line.startsWith("LIB ")) {
      currentLibraryId = line.substring(4);
    } else if (line.startsWith("ADD ")) {
      int s1 = line.indexOf(' ', 4);
      int s2 = line.indexOf(' ', s1 + 1);
      if (s1 > 0 && s2 > 0) {
        AuthCredential cred;
        strncpy(cred.uid, line.substring(4, s1).c_str(), 39);
        cred.uid[39] = '\0';
        cred.validFrom = line.substring(s1 + 1, s2).toInt();
        cred.validUntil = line.substring(s2 + 1).toInt();
        authSnapshot.push_back(cred);
      }
    }
  }
  file.close();
  Serial.println("Loaded snapshot, REV: " + String(currentAuthRevision) + ", records: " + String(authSnapshot.size()));
}

void syncSnapshot() {
  if (WiFi.status() != WL_CONNECTED) return;
  Serial.println("Syncing snapshot...");
  WiFiClientSecure *client = new WiFiClientSecure;
  if (client) {
    client->setCACert(rootCACertificate);
    HTTPClient http;
    String url = String(SUPABASE_URL) + "/api/hardware/sync?macAddress=" + String(READER_ID) + "&revision=" + String(currentAuthRevision);
    http.begin(*client, url);
    http.setTimeout(15000);
    int httpCode = http.GET();
    if (httpCode == 200) {
      String response = http.getString();
      if (response.indexOf("UP_TO_DATE") == -1) {
        File file = LittleFS.open("/snapshot.txt.tmp", "w");
        if (file) {
          file.print(response);
          file.close();
          LittleFS.remove("/snapshot.txt");
          LittleFS.rename("/snapshot.txt.tmp", "/snapshot.txt");
          loadSnapshotFromFlash();
        }
      } else {
        // Parse LIB from UP_TO_DATE response if available
        int libIdx = response.indexOf("LIB ");
        if (libIdx != -1) {
          int endIdx = response.indexOf('\n', libIdx);
          if (endIdx != -1) {
            currentLibraryId = response.substring(libIdx + 4, endIdx);
            currentLibraryId.trim();
          }
        }
      }
    }
    http.end();
    delete client;
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg;
  for (int i = 0; i < length; i++) msg += (char)payload[i];
  Serial.println("MQTT msg: " + msg);
  StaticJsonDocument<256> doc;
  if (!deserializeJson(doc, msg)) {
    if (doc.containsKey("revision")) {
      uint32_t newRev = doc["revision"];
      if (newRev > currentAuthRevision) {
        syncSnapshot();
      }
    }
  }
}

void reconnectMqtt() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (!mqttClient.connected()) {
    mqttClient.setServer(mqtt_server, 1883);
    mqttClient.setCallback(mqttCallback);
    String clientId = "FocusX-" + String(READER_ID);
    if (mqttClient.connect(clientId.c_str())) {
      if (currentLibraryId.length() > 0) {
        String topic = "library/" + currentLibraryId + "/auth/revision";
        mqttClient.subscribe(topic.c_str());
      }
    }
  }
}
"""
code = code.replace("void initJournal() {", offline_logic + "\nvoid initJournal() {")

# 3. Setup additions
setup_additions = r"""
  loadSnapshotFromFlash();
  syncSnapshot();
  reconnectMqtt();
"""
code = code.replace("initJournal();\n", "initJournal();\n" + setup_additions)

# 4. Loop additions
loop_additions = r"""
  if (!mqttClient.connected()) {
    static unsigned long lastMqttReconnect = 0;
    if (millis() - lastMqttReconnect > 5000) {
      reconnectMqtt();
      lastMqttReconnect = millis();
    }
  } else {
    mqttClient.loop();
  }
"""
code = code.replace("void loop() {\n  unsigned long currentMillis = millis();\n", "void loop() {\n  unsigned long currentMillis = millis();\n" + loop_additions)

# 5. Fix doAuth to be fully offline!
original_doauth = r"""void doAuth(String uid, bool isExit) {
  setLEDsColor(255, 255, 0);
  if (isExit) setRFID2StripColor(255, 255, 0);
  lcd.clear();
  lcd.setCursor(0,0); lcd.print("AUTHORIZING...");
  tone(BUZZER_PIN, 1500, 100);
  
  AuthResponse staleRes;
  while(xQueueReceive(authResponseQueue, &staleRes, 0) == pdPASS) {}
  
  ScanEvent e;
  currentSeqNo++;
  e.seqNo = currentSeqNo;
  e.eventId = String(READER_ID) + "-" + String(bootCount) + "-" + String(currentSeqNo);
  e.scanType = "rfid";
  e.payload = uid;
  e.timestampMs = millis();
  e.isExit = isExit;
  
  appendToJournal(e);
  
  portENTER_CRITICAL(&queueMutex);
  if (pendingEvents.size() < 500 && !hasMoreOnFlash) {
    pendingEvents.push_back(e);
  } else {
    hasMoreOnFlash = true;
  }
  portEXIT_CRITICAL(&queueMutex);
}"""

new_doauth = r"""void doAuth(String uid, String scanType, bool isExit) {
  setLEDsColor(255, 255, 0);
  if (isExit) setRFID2StripColor(255, 255, 0);
  lcd.clear();
  lcd.setCursor(0,0); lcd.print("AUTHORIZING...");
  tone(BUZZER_PIN, 1500, 100);
  
  bool isAllowed = false;
  uint32_t nowUnix = time(NULL);
  
  for (const auto& cred : authSnapshot) {
    if (String(cred.uid) == uid) {
      if (nowUnix >= cred.validFrom && nowUnix <= cred.validUntil) {
        isAllowed = true;
        break;
      } else if (nowUnix < 1000000000) {
        // NTP not synced, failsafe allow based on presence
        isAllowed = true;
        break;
      }
    }
  }
  
  ScanEvent e;
  currentSeqNo++;
  e.seqNo = currentSeqNo;
  e.eventId = String(READER_ID) + "-" + String(bootCount) + "-" + String(currentSeqNo);
  e.scanType = scanType;
  e.payload = uid;
  e.timestampMs = millis();
  e.timestampUnix = nowUnix;
  e.isExit = isExit;
  e.authRevision = currentAuthRevision;
  e.offlineDecision = isAllowed;
  
  if (isAllowed) {
    isGateOpen = true;
    gateOpenStartTime = millis();
    hasDoorOpenedDuringGrace = false;
    openedByRFID2 = isExit;
    if (isExit) {
      setLEDsColor(255, 80, 0);
      setRFID2StripColor(0, 255, 0);
      userIsInside = false;
      lcd.clear(); lcd.setCursor(0,0); lcd.print("GOODBYE!");
      playGoodbyeChime();
    } else {
      setLEDsColor(0, 255, 0);
      userIsInside = true;
      lcd.clear(); lcd.setCursor(0,0); lcd.print("WELCOME!");
      playWelcomeChime();
    }
    delay(1000);
  } else {
    setLEDsColor(255, 0, 0);
    if (isExit) setRFID2StripColor(255, 0, 0);
    lcd.clear(); lcd.setCursor(0,0); lcd.print("ACCESS DENIED");
    playDeniedChime();
    delay(2000);
    resetToIdle();
  }
  
  appendToJournal(e);
  
  portENTER_CRITICAL(&queueMutex);
  if (pendingEvents.size() < 500 && !hasMoreOnFlash) {
    pendingEvents.push_back(e);
  } else {
    hasMoreOnFlash = true;
  }
  portEXIT_CRITICAL(&queueMutex);
}"""

code = code.replace(original_doauth, new_doauth)

# Add timestampUnix, authRevision, offlineDecision to ScanEvent
scan_event_old = r"""struct ScanEvent {
  uint32_t seqNo;
  String eventId;
  String scanType;
  String payload;
  unsigned long timestampMs;
  bool isExit;
};"""
scan_event_new = r"""struct ScanEvent {
  uint32_t seqNo;
  String eventId;
  String scanType;
  String payload;
  unsigned long timestampMs;
  uint32_t timestampUnix;
  uint32_t authRevision;
  bool offlineDecision;
  bool isExit;
};"""
code = code.replace(scan_event_old, scan_event_new)

# Update journal append/reload to include new fields!
# Since we change journal format, we should probably clear the journal but for now we'll just parse more fields.
# Actually, the user asked to preserve idempotency and ordering. 
# We will just append them.
journal_append_old = r"""String content = String(e.seqNo) + " " + e.eventId + " " + e.scanType + " " + e.payload + " " + String(e.timestampMs) + " " + String(e.isExit ? 1 : 0);"""
journal_append_new = r"""String content = String(e.seqNo) + " " + e.eventId + " " + e.scanType + " " + e.payload + " " + String(e.timestampMs) + " " + String(e.isExit ? 1 : 0) + " " + String(e.timestampUnix) + " " + String(e.authRevision) + " " + String(e.offlineDecision ? 1 : 0);"""
code = code.replace(journal_append_old, journal_append_new)

journal_read_old = r"""int s6 = line.indexOf(' ', s5 + 1);

      if (s1 > 0 && s6 > 0) {"""
journal_read_new = r"""int s6 = line.indexOf(' ', s5 + 1);
      int s7 = line.indexOf(' ', s6 + 1);
      int s8 = line.indexOf(' ', s7 + 1);
      int s9 = line.indexOf(' ', s8 + 1);

      if (s1 > 0 && s9 > 0) {"""
code = code.replace(journal_read_old, journal_read_new)

journal_read2_old = r"""e.timestampMs = line.substring(s4 + 1, s5).toInt();
            e.isExit = line.substring(s5 + 1, s6).toInt() == 1;

            uint32_t crc_read = line.substring(s6 + 1).toInt();
            uint32_t crc_calc = 0;
            String content = line.substring(4, s6);"""
journal_read2_new = r"""e.timestampMs = line.substring(s4 + 1, s5).toInt();
            e.isExit = line.substring(s5 + 1, s6).toInt() == 1;
            e.timestampUnix = line.substring(s6 + 1, s7).toInt();
            e.authRevision = line.substring(s7 + 1, s8).toInt();
            e.offlineDecision = line.substring(s8 + 1, s9).toInt() == 1;

            uint32_t crc_read = line.substring(s9 + 1).toInt();
            uint32_t crc_calc = 0;
            String content = line.substring(4, s9);"""
code = code.replace(journal_read2_old, journal_read2_new)


# Update httpWorkerTask payload and logic
worker_old = r"""            reqDoc["eventId"] = currentEvent.eventId;
            reqDoc["readerId"] = READER_ID.c_str();
            reqDoc["scanType"] = currentEvent.scanType;
            reqDoc["payload"] = currentEvent.payload;"""
worker_new = r"""            reqDoc["eventId"] = currentEvent.eventId;
            reqDoc["readerId"] = READER_ID.c_str();
            reqDoc["scanType"] = currentEvent.scanType;
            reqDoc["payload"] = currentEvent.payload;
            reqDoc["timestampUnix"] = currentEvent.timestampUnix;
            reqDoc["authRevision"] = currentEvent.authRevision;
            reqDoc["offlineDecision"] = currentEvent.offlineDecision ? "ALLOW" : "DENY";"""
code = code.replace(worker_old, worker_new)

worker_status_old = r"""if (httpCode >= 200 && httpCode < 300) {
              String responseBody = http.getString();
              StaticJsonDocument<512> resDoc;
              DeserializationError err = deserializeJson(resDoc, responseBody);
              if (!err && resDoc.containsKey("status")) {
                String status = resDoc["status"];
                if (status == "APPROVED" || status == "GRANTED" || status == "ALLOW") {
                     res.resultCode = 1;
                     if (resDoc.containsKey("direction")) {
                         strncpy(res.direction, resDoc["direction"], 15);
                     } else {
                         strcpy(res.direction, currentEvent.isExit ? "OUT" : "IN");
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
              success = true;
            }"""
worker_status_new = r"""if (httpCode >= 200 && httpCode < 300) {
              success = true; // Offline Auth Model: We just trust it successfully uploaded!
            }"""
code = code.replace(worker_status_old, worker_status_new)

# Remove the authResponseQueue handling from loop since doAuth is fully local now
# The AuthResponse is no longer sent to authResponseQueue!
code = code.replace("xQueueSend(authResponseQueue, &res, 0);", "")
code = code.replace("AuthResponse res;", "")
loop_auth_handling = r"""  if (xQueueReceive(authResponseQueue, &res, 0) == pdPASS) {
    if (res.resultCode == 1) { 
      isGateOpen = true;
      gateOpenStartTime = millis();
      hasDoorOpenedDuringGrace = false;
      openedByRFID2 = res.isExit;
      if (String(res.direction) == "OUT" || res.isExit) {
        setLEDsColor(255, 80, 0);
        setRFID2StripColor(0, 255, 0);
        userIsInside = false;
        lcd.clear(); lcd.setCursor(0,0); lcd.print("GOODBYE!");
        lcd.setCursor(0,1); lcd.print("GATE OPEN");
        playGoodbyeChime();
      } else {
        setLEDsColor(0, 255, 0);
        userIsInside = true;
        lcd.clear(); lcd.setCursor(0,0); lcd.print("WELCOME!");
        lcd.setCursor(0,1); lcd.print("GATE OPEN");
        playWelcomeChime();
      }
    } else if (res.resultCode == 2) { 
      setLEDsColor(255, 0, 0);
      if (res.isExit) setRFID2StripColor(255, 0, 0);
      lcd.clear(); lcd.setCursor(0,0); lcd.print(res.message);
      playDeniedChime();
      delay(2000);
      resetToIdle();
    } else if (res.resultCode == 4) {
      setLEDsColor(255, 0, 0);
      if (res.isExit) setRFID2StripColor(255, 0, 0);
      lcd.clear(); lcd.setCursor(0,0); lcd.print("NETWORK TIMEOUT");
      playDeniedChime();
      delay(2000);
      resetToIdle();
    }
  }"""
code = code.replace(loop_auth_handling, "")

# Fix RFID calls to pass "rfid"
code = code.replace("doAuth(uid, false);", 'doAuth(uid, "rfid", false);')
code = code.replace("doAuth(uid, true);", 'doAuth(uid, "rfid", true);')

# Fix BLE onWrite
ble_old = r"""void onWrite(NimBLECharacteristic *pCharacteristic, NimBLEConnInfo& connInfo) override {
        std::string value = pCharacteristic->getValue();
        if (value.length() > 0) {
          if (value == "UNLOCK_IN") remoteOpenIn = true;
          else if (value == "UNLOCK_OUT") remoteOpenOut = true;
        }
      }"""
ble_new = r"""void onWrite(NimBLECharacteristic *pCharacteristic, NimBLEConnInfo& connInfo) override {
        std::string value = pCharacteristic->getValue();
        String val = String(value.c_str());
        if (val.startsWith("AUTH_IN:")) {
          String uid = val.substring(8);
          doAuth(uid, "ble", false);
        } else if (val.startsWith("AUTH_OUT:")) {
          String uid = val.substring(9);
          doAuth(uid, "ble", true);
        }
      }"""
code = code.replace(ble_old, ble_new)


with open("FocusX_Scanner_Firmware_V5_DualRFID/FocusX_Scanner_Firmware_V5_DualRFID.ino", "w") as f:
    f.write(code)
