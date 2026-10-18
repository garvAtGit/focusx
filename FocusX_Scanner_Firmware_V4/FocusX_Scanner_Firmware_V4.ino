#include <WiFiManager.h>
#include <time.h>
#include <esp_task_wdt.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <Adafruit_PN532.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <HardwareSerial.h>
#include <BLEDevice.h>
#include <esp_gap_ble_api.h>
#include <Preferences.h>
#include <SparkFun_VL53L5CX_Library.h>
#include <ESPSupabaseRealtime.h>
#include <ArduinoJson.h>

// =================================================
// CONFIGURATION & SECRETS
// =================================================

// SUPABASE CONFIG (Public Anon Key is safe to bundle)
const char* SUPABASE_URL = "https://iiozcipbxsmjasgglsyf.supabase.co";
const char* SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpb3pjaXBieHNtamFzZ2dsc3lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzU1MjgsImV4cCI6MjA5NjE1MTUyOH0.V0TETykYX5KNAVOvaj039reZmURocfKac3voZrku-a0";
SupabaseRealtime realtime;

char WIFI_SSID[64] = "";
char WIFI_PASSWORD[64] = "";

const char* API_URL = "https://www.focusx.in/api/hardware/scan";

// CRITICAL TODO FOR PRODUCTION:
// Provision hardware securely via NVS or Secure Element. 
// Do NOT commit actual production keys to source control.
char HARDWARE_API_KEY[64] = "";
String READER_ID = ""; 

// Verified Let's Encrypt ISRG Root X1 (for standard Vercel/Web deployments)
const char* rootCACertificate = \
"-----BEGIN CERTIFICATE-----\n" \
"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\n" \
"-----END CERTIFICATE-----\n";

// =================================================
// HARDWARE PINOUT (STRICTLY AS PRESCRIBED)
// =================================================
#define PN532_SS 4
#define SDA_PIN 21
#define SCL_PIN 22
#define QR_RX_PIN 16
#define QR_TX_PIN 17
#define IR_PIN 13
#define BUZZER_PIN 25
#define LED_TOGGLE_PIN 33
#define BREATHING_LED_PIN 2

// =================================================
// OBJECTS & GLOBALS
// =================================================
Adafruit_PN532 nfc(PN532_SS);
bool pn532Available = false;

LiquidCrystal_I2C lcd(0x27, 16, 2);
HardwareSerial QRSerial(2);
Preferences preferences;

enum SystemState {
  STATE_INITIALIZING,
  STATE_IDLE,
  STATE_AUTHORIZING,
  STATE_FEEDBACK
};
SystemState currentState = STATE_INITIALIZING;

unsigned long stateStartTime = 0;
unsigned long gracePeriodEnd = 0;

String qrBuffer = "";
const int MAX_QR_LENGTH = 512; 

bool isDetectingIR = false;
unsigned long irDetectStartTime = 0;
unsigned long alarmEndTime = 0;

int buzzerType = 0; // 0=None, 1=Entry, 2=Exit, 3=Alarm, 4=Deny
int buzzerState = 0;
unsigned long buzzerNextTime = 0;

String lastLcdRow0 = "";
String lastLcdRow1 = "";

// =================================================
// FREERTOS SYNCHRONIZATION QUEUES
// =================================================
struct AuthRequest {
  char scanType[16];
  char payload[256];
  char eventId[64];
};

struct AuthResponse { int resultCode; char message[64]; char direction[16]; }; QueueHandle_t authRequestQueue; QueueHandle_t authResponseQueue;




// Durable Retry UX State
bool pendingRetry = false;
String pendingRetryPayload = "";
String pendingRetryScanType = "";
String pendingRetryEventId = "";
unsigned long pendingRetryTimestamp = 0;

SparkFun_VL53L5CX myImager;
int previousZone = 0;

// =================================================
// HELPER: LCD & LEDS
// =================================================

void HandleRealtimeChanges(String result) {
  JsonDocument doc;
  deserializeJson(doc, result);
  String recordStr = doc["record"].as<String>();
  if (recordStr != "null") {
    String pendingCmd = doc["record"]["pendingCommand"].as<String>();
    if (pendingCmd == "factory_reset") {
      Serial.println("[Realtime] Factory Reset Command Received! Self-Destructing...");
      updateLCD("FACTORY RESET", "WIPING MEMORY...");
      triggerBuzzer(4);
      delay(2000);
      WiFiManager wm;
      wm.resetSettings();
      preferences.clear();
      ESP.restart();
    }
  }
}

void updateLCD(String row0, String row1) {
  if (row0 != lastLcdRow0 || row1 != lastLcdRow1) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(row0);
    lcd.setCursor(0, 1);
    lcd.print(row1);
    lastLcdRow0 = row0;
    lastLcdRow1 = row1;
  }
}

void setIdleLCD() {
  if (buzzerType == 3) { 
    updateLCD("!!! ALARM !!!", "UNAUTHORIZED!");
    return;
  }
  if (pendingRetry) {
    updateLCD("NETWORK ERROR", "TAP TO RETRY");
    return;
  }
  updateLCD("\x01 SYSTEM ARMED", "TAP YOUR CARD");
}

void setArmedVisual() { digitalWrite(LED_TOGGLE_PIN, LOW); }
void setAccessGrantedVisual() { digitalWrite(LED_TOGGLE_PIN, HIGH); }
void setAccessDeniedVisual() { digitalWrite(LED_TOGGLE_PIN, LOW); }

// =================================================
// HELPER: BUZZER STATE MACHINE
// =================================================
void triggerBuzzer(int type) {
  buzzerType = type;
  buzzerState = 1;
  buzzerNextTime = millis();
}

void processBuzzer() {
  if (buzzerType == 0) return;
  if (millis() < buzzerNextTime) return;

  if (buzzerType == 1) { // Entry Chime
    switch (buzzerState) {
      case 1: tone(BUZZER_PIN, 523); buzzerNextTime = millis() + 100; buzzerState++; break;
      case 2: noTone(BUZZER_PIN); buzzerNextTime = millis() + 20; buzzerState++; break;
      case 3: tone(BUZZER_PIN, 659); buzzerNextTime = millis() + 100; buzzerState++; break;
      case 4: noTone(BUZZER_PIN); buzzerNextTime = millis() + 20; buzzerState++; break;
      case 5: tone(BUZZER_PIN, 784); buzzerNextTime = millis() + 100; buzzerState++; break;
      case 6: noTone(BUZZER_PIN); buzzerNextTime = millis() + 20; buzzerState++; break;
      case 7: tone(BUZZER_PIN, 1047); buzzerNextTime = millis() + 300; buzzerState++; break;
      default: noTone(BUZZER_PIN); buzzerType = 0; break;
    }
  } else if (buzzerType == 2) { // Exit Chime
    switch (buzzerState) {
      case 1: tone(BUZZER_PIN, 1047); buzzerNextTime = millis() + 100; buzzerState++; break;
      case 2: noTone(BUZZER_PIN); buzzerNextTime = millis() + 20; buzzerState++; break;
      case 3: tone(BUZZER_PIN, 784); buzzerNextTime = millis() + 100; buzzerState++; break;
      case 4: noTone(BUZZER_PIN); buzzerNextTime = millis() + 20; buzzerState++; break;
      case 5: tone(BUZZER_PIN, 659); buzzerNextTime = millis() + 100; buzzerState++; break;
      case 6: noTone(BUZZER_PIN); buzzerNextTime = millis() + 20; buzzerState++; break;
      case 7: tone(BUZZER_PIN, 523); buzzerNextTime = millis() + 300; buzzerState++; break;
      default: noTone(BUZZER_PIN); buzzerType = 0; break;
    }
  } else if (buzzerType == 3) { // Intrusion Alarm (Loops)
    if (buzzerState == 1) {
      tone(BUZZER_PIN, 3000); buzzerNextTime = millis() + 120; buzzerState = 2;
    } else {
      tone(BUZZER_PIN, 1500); buzzerNextTime = millis() + 120; buzzerState = 1;
    }
  } else if (buzzerType == 4) { // Denied Chime
    if (buzzerState == 1) {
      tone(BUZZER_PIN, 300); buzzerNextTime = millis() + 300; buzzerState++;
    } else {
      noTone(BUZZER_PIN); buzzerType = 0;
    }
  }
}

// =================================================
// BACKGROUND HTTP WORKER TASK (TLS ENABLED)
// =================================================
void httpWorkerTask(void *pvParameters) {
  AuthRequest req;
  
  while (true) {
    if (xQueueReceive(authRequestQueue, &req, portMAX_DELAY) == pdPASS) {
      AuthResponse res;
      res.resultCode = 3; // Default to ERROR
      strncpy(res.message, "SERVER ERROR", sizeof(res.message)-1);
      res.message[sizeof(res.message)-1] = '\0';
      
      strncpy(res.direction, "", sizeof(res.direction)-1);
      res.direction[sizeof(res.direction)-1] = '\0';

      if (WiFi.status() == WL_CONNECTED) {
        WiFiClientSecure client;
        client.setCACert(rootCACertificate); // Strict TLS Validation
        
        HTTPClient http;
        if (http.begin(client, API_URL)) {
          http.addHeader("Content-Type", "application/json");
          http.addHeader("Authorization", String("Bearer ") + HARDWARE_API_KEY);
          http.setTimeout(5000);

          StaticJsonDocument<256> reqDoc;
          reqDoc["eventId"] = req.eventId;
          reqDoc["readerId"] = READER_ID.c_str();
          reqDoc["scanType"] = req.scanType;
          reqDoc["payload"] = req.payload;
          
          String requestBody;
          serializeJson(reqDoc, requestBody);

          int httpCode = http.POST(requestBody);

          // STRICT HTTP STATUS REQUIREMENT (200-299)
          if (httpCode >= 200 && httpCode < 300) {
            String responseBody = http.getString();
            
            if (responseBody.length() > 2048) {
               strncpy(res.message, "RESP TOO LARGE", sizeof(res.message)-1);
               res.message[sizeof(res.message)-1] = '\0';
            } else {
              StaticJsonDocument<512> resDoc;
              DeserializationError err = deserializeJson(resDoc, responseBody);

              if (!err && resDoc.containsKey("status")) {
                String status = resDoc["status"]; 
                String dir = resDoc.containsKey("direction") ? resDoc["direction"].as<String>() : "";
                String msg = resDoc.containsKey("message") ? resDoc["message"].as<String>() : "";
                
                strncpy(res.direction, dir.c_str(), sizeof(res.direction)-1);
                res.direction[sizeof(res.direction)-1] = '\0';
                
                strncpy(res.message, msg.c_str(), sizeof(res.message)-1);
                res.message[sizeof(res.message)-1] = '\0';

                // Explicit strict validation of the contract
                if (status == "ALLOW") {
                  res.resultCode = 1;
                } else if (status == "DENY" || status == "DENIED") {
                  res.resultCode = 2;
                } else {
                  res.resultCode = 3;
                  strncpy(res.message, "INVALID STATUS", sizeof(res.message)-1);
                  res.message[sizeof(res.message)-1] = '\0';
                }
              } else {
                strncpy(res.message, "BAD CONTRACT", sizeof(res.message)-1);
                res.message[sizeof(res.message)-1] = '\0';
                res.resultCode = 3;
              }
            }
          } else if (httpCode > 0) {
            snprintf(res.message, sizeof(res.message)-1, "HTTP %d", httpCode);
            res.message[sizeof(res.message)-1] = '\0';
            res.resultCode = 3;
          } else {
            strncpy(res.message, "NET TIMEOUT/FAIL", sizeof(res.message)-1);
            res.message[sizeof(res.message)-1] = '\0';
            res.resultCode = 3;
          }
          http.end();
        } else {
           strncpy(res.message, "HTTP SETUP FAIL", sizeof(res.message)-1);
           res.message[sizeof(res.message)-1] = '\0';
        }
      } else {
        strncpy(res.message, "WIFI DROPPED", sizeof(res.message)-1);
        res.message[sizeof(res.message)-1] = '\0';
      }

      // Send to main loop (Block up to 1 second instead of silently dropping if queue full)
      if (xQueueSend(authResponseQueue, &res, pdMS_TO_TICKS(1000)) != pdPASS) {
         Serial.println("[HTTP] FATAL: Failed to place response into queue!");
      }
    }
  }
}

// =================================================
// AUTHORIZATION LOGIC
// =================================================
String generateStrongEventId() {
  uint64_t mac = ESP.getEfuseMac();
  uint32_t mac_high = (uint32_t)(mac >> 32);
  uint32_t mac_low = (uint32_t)mac;
  
  // Custom device-specific UUID-shaped structure embedding ESP32 MAC
  char buf[40];
  snprintf(buf, sizeof(buf), "%04x%04x-%04x-4%03x-%04x-%04x%04x%04x",
           (uint16_t)(mac_high & 0xFFFF), (uint16_t)(mac_low >> 16),
           (uint16_t)(mac_low & 0xFFFF),
           (uint16_t)(esp_random() & 0x0FFF),
           (uint16_t)((esp_random() & 0x3FFF) | 0x8000),
           (uint16_t)(esp_random() & 0xFFFF), (uint16_t)(esp_random() & 0xFFFF), (uint16_t)(esp_random() & 0xFFFF));
  return String(buf);
}

void startAuthorization(String payload, String scanType) {
  // Guard 1: Must be in IDLE state locally
  if (currentState != STATE_IDLE) {
     return;
  }

  // Guard 2: No Data Loss / Offline Overwrite Prevention
  // If an event is pending acknowledgement, we absolutely refuse 
  // to overwrite it with a DIFFERENT user's scan.
  if (pendingRetry && (payload != pendingRetryPayload || scanType != pendingRetryScanType)) {
     Serial.println("[AUTH] Refused: A previous scan is pending network recovery. Cannot overwrite.");
     updateLCD("SYSTEM OFFLINE", "PLEASE WAIT");
     triggerBuzzer(4);
     return;
  }

  AuthRequest req;
  
  if (pendingRetry) {
    strncpy(req.eventId, pendingRetryEventId.c_str(), sizeof(req.eventId)-1);
    Serial.printf("\n[RETRY] Reusing EventID: %s\n", req.eventId);
  } else {
    String newId = generateStrongEventId();
    strncpy(req.eventId, newId.c_str(), sizeof(req.eventId)-1);
    
    // DURABLE RECORDING OF THE NEW EVENT INTENT
    preferences.begin("focusx", false);
    preferences.putBool("retryActive", true);
    preferences.putString("retryPayload", payload);
    preferences.putString("retryType", scanType);
    preferences.putString("retryEventId", String(req.eventId));
    preferences.end();
    
    pendingRetry = true; 
    Serial.printf("\n[%s] New Scan: %s (EventID: %s)\n", scanType.c_str(), payload.c_str(), req.eventId);
  }

  // Explicit null termination guarantees
  req.eventId[sizeof(req.eventId)-1] = '\0';
  
  strncpy(req.payload, payload.c_str(), sizeof(req.payload)-1);
  req.payload[sizeof(req.payload)-1] = '\0';
  
  strncpy(req.scanType, scanType.c_str(), sizeof(req.scanType)-1);
  req.scanType[sizeof(req.scanType)-1] = '\0';
  
  // Track in RAM
  pendingRetryPayload = payload;
  pendingRetryScanType = scanType;
  pendingRetryEventId = String(req.eventId);
  pendingRetryTimestamp = millis(); // Kept for UI logic, though NVS drives recovery

  // Dispatch to HTTP Worker
  if (xQueueSend(authRequestQueue, &req, 0) == pdPASS) {
    currentState = STATE_AUTHORIZING;
    updateLCD("AUTHORIZING...", "PLEASE WAIT");
  } else {
    Serial.println("[ERROR] Failed to queue AuthRequest (Queue Full)");
  }
}

void processAuthResponse(AuthResponse res) {
  if (res.resultCode == 1 || res.resultCode == 2) {
    // Both ALLOW and DENY are definitive business states that conclude the transaction.
    // Durably mark the event as acknowledged/cleared.
    if (pendingRetry) {
      preferences.begin("focusx", false);
      preferences.putBool("retryActive", false);
      preferences.end();
      pendingRetry = false; 
    }
  }

  if (res.resultCode == 1) { // ALLOW
    Serial.println("[ATTENDANCE] SUCCESS");
    setAccessGrantedVisual();
    gracePeriodEnd = millis() + 5000;

    if (String(res.direction) == "OUT") {
      updateLCD("\x02 GOODBYE!", String(res.message).length() > 0 ? String(res.message) : "PROCEED");
      triggerBuzzer(2);
    } else {
      updateLCD("\x02 WELCOME IN!", String(res.message).length() > 0 ? String(res.message) : "PROCEED");
      triggerBuzzer(1);
    }
  } else if (res.resultCode == 2) { // DENIED (Business rule applied)
    Serial.println("[ATTENDANCE] DENIED");
    setAccessDeniedVisual();

    updateLCD("ACCESS DENIED", String(res.message).length() > 0 ? String(res.message) : "TRY AGAIN");
    triggerBuzzer(4);
  } else { // ERROR (Network, 5xx, or malformed)
    // We intentionally LEAVE pendingRetry = true and do not clear NVS.
    // This allows recovery across reboots or user-driven retries.
    Serial.printf("[HTTP] NETWORK OR SERVER ERROR: %s\n", res.message);
    pendingRetry = true; 
    pendingRetryTimestamp = millis(); // Snapshot time of failure
    updateLCD("NETWORK ERROR", "TAP TO RETRY");
  }

  currentState = STATE_FEEDBACK;
  stateStartTime = millis();
}

// =================================================
// SENSOR CHECKS
// =================================================
void checkRFID() {
  if (!pn532Available) return;

  uint8_t uid[] = {0, 0, 0, 0, 0, 0, 0};
  uint8_t uidLength;

  bool success = nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 10);
  if (!success) return; 

  static unsigned long lastRFIDTime = 0;
  // 2000ms debounce to prevent repeated reads while a card sits on the scanner
  if (millis() - lastRFIDTime < 2000) return;
  lastRFIDTime = millis();

  String uidStr = "";
  for (uint8_t i = 0; i < uidLength; i++) {
    if (i > 0) uidStr += ":";
    if (uid[i] < 0x10) uidStr += "0";
    uidStr += String(uid[i], HEX);
  }
  uidStr.toUpperCase();

  startAuthorization(uidStr, "RFID");
}

void checkQR() {
  static unsigned long lastQRCharTime = 0;

  // Stale data timeout: Discard incomplete QR tokens older than 1.5 seconds
  if (qrBuffer.length() > 0 && millis() - lastQRCharTime > 1500) {
    qrBuffer = "";
  }

  while (QRSerial.available()) {
    char c = QRSerial.read();
    lastQRCharTime = millis();
    
    // Completely drain and discard if we are busy
    if (currentState != STATE_IDLE) {
      qrBuffer = "";
      continue;
    }

    if (c == '\n' || c == '\r') {
      if (qrBuffer.length() > 0) {
        String token = qrBuffer;
        qrBuffer = ""; 
        startAuthorization(token, "QR");
      }
    } else {
      qrBuffer += c;
      if (qrBuffer.length() > MAX_QR_LENGTH) {
        qrBuffer = ""; 
      }
    }
  }
}

void checkIR() {
  if (millis() < gracePeriodEnd) {
    if (buzzerType == 3) {
      buzzerType = 0;
      noTone(BUZZER_PIN);
      if (currentState == STATE_IDLE) setIdleLCD();
    }
    return;
  }

  // INSTANT TRIGGER: Zero Debounce to catch fast/thin objects
  if (digitalRead(IR_PIN) == LOW) {
    if (buzzerType != 3) { 
      Serial.println("[IR] INTRUSION DETECTED");
      triggerBuzzer(3);
      updateLCD("!!! ALARM !!!", "UNAUTHORIZED!");
    }
    alarmEndTime = millis() + 2000; 
  }

  if (buzzerType == 3 && millis() > alarmEndTime) {
    buzzerType = 0;
    noTone(BUZZER_PIN);
    Serial.println("[IR] ALARM ENDED");
    if (currentState == STATE_IDLE) {
      setIdleLCD();
    }
  }
}

// =================================================
// EXISTING TESTED BLE BEACON LOGIC (PRESERVED)
// =================================================

// Consider moving Major/Minor values into NVS if scaling to multiple doors
static esp_ble_adv_params_t adv_params = {
  .adv_int_min       = 0x20,
  .adv_int_max       = 0x40,
  .adv_type          = ADV_TYPE_NONCONN_IND,
  .own_addr_type     = BLE_ADDR_TYPE_PUBLIC,
  .peer_addr         = {0},
  .peer_addr_type    = BLE_ADDR_TYPE_PUBLIC,
  .channel_map       = ADV_CHNL_ALL,
  .adv_filter_policy = ADV_FILTER_ALLOW_SCAN_ANY_CON_ANY,
};

void my_gap_event_handler(esp_gap_ble_cb_event_t event, esp_ble_gap_cb_param_t *param) {
  if (event == ESP_GAP_BLE_ADV_DATA_RAW_SET_COMPLETE_EVT) {
    // Properly sequence starting advertising *after* raw data is set
    esp_err_t err = esp_ble_gap_start_advertising(&adv_params);
    if (err == ESP_OK) {
        Serial.println("[BLE] Advertising initialization dispatched.");
    } else {
        Serial.printf("[BLE] Error starting advertising: %d\n", err);
    }
  } else if (event == ESP_GAP_BLE_ADV_START_COMPLETE_EVT) {
    if (param->adv_data_cmpl.status == ESP_BT_STATUS_SUCCESS) {
      Serial.println("[BLE] GAP callback: Advertising successfully started.");
    } else {
      Serial.printf("[BLE] GAP callback: Failed to start advertising. Status: %d\n", param->adv_data_cmpl.status);
    }
  }
}

void initBLE() {
  Serial.println("[BLE] Initializing Beacon...");
  BLEDevice::init("");
  
  esp_err_t cb_err = esp_ble_gap_register_callback(my_gap_event_handler);
  if (cb_err != ESP_OK) {
    Serial.printf("[BLE] Critical Error: Failed to register GAP callback: %d\n", cb_err);
  }

  uint8_t raw_adv_data[] = {
      0x02, 0x01, 0x06,
      0x1A, 0xFF, 0x4C, 0x00, 
      0x02, 0x15, 
      0x87, 0xb9, 0x9b, 0x2c, 0x90, 0xfd, 0x11, 0xe9, 0xbc, 0x42, 0x52, 0x6a, 0xf7, 0x76, 0x4f, 0x64,
      0x00, 0x01, 
      0x00, 0x01, 
      0xC5        
  };

  // Triggers ESP_GAP_BLE_ADV_DATA_RAW_SET_COMPLETE_EVT when finished
  esp_err_t err = esp_ble_gap_config_adv_data_raw(raw_adv_data, sizeof(raw_adv_data));
  if (err != ESP_OK) {
      Serial.printf("[BLE] Error configuring adv data: %d\n", err);
  }
}

// =================================================
// SETUP
// =================================================
void setup() {
  authRequestQueue = xQueueCreate(10, sizeof(AuthRequest));
  authResponseQueue = xQueueCreate(10, sizeof(AuthResponse));
  xTaskCreatePinnedToCore(httpWorkerTask, "HTTP", 8192, NULL, 1, NULL, 0);

  WiFi.mode(WIFI_STA);
  READER_ID = WiFi.macAddress();
  READER_ID.replace(":", ""); // e.g. A1B2C3D4E5F6

  Serial.begin(115200);
  delay(1000); 

  // 0. NVS Recovery
  preferences.begin("focusx", false);
  pendingRetry = preferences.getBool("retryActive", false);
  if (pendingRetry) {
    pendingRetryPayload = preferences.getString("retryPayload", "");
    pendingRetryScanType = preferences.getString("retryType", "");
    pendingRetryEventId = preferences.getString("retryEventId", "");
    pendingRetryTimestamp = millis(); 
    Serial.printf("[RECOVERY] Loaded unacknowledged scan for %s (EventID: %s)\n", 
      pendingRetryScanType.c_str(), pendingRetryEventId.c_str());
  }
  preferences.end();

  // 1. GPIO
  pinMode(IR_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_TOGGLE_PIN, OUTPUT);
  pinMode(BREATHING_LED_PIN, OUTPUT);
  setArmedVisual();
  noTone(BUZZER_PIN);

  // 2. LCD
  Wire.begin(SDA_PIN, SCL_PIN);
  if (myImager.begin() == false) {
    Serial.println(F("VL53L5CX not found - check wiring!"));
  } else {
    myImager.setResolution(8 * 8);
    myImager.setRangingFrequency(15);
    myImager.startRanging();
    Serial.println(F("VL53L5CX ToF Sensor initialized."));
  }

  realtime.begin(SUPABASE_URL, SUPABASE_ANON_KEY, HandleRealtimeChanges);
  // Listen to the Relay table for our specific reader
  String filter = "bleReaderId=eq." + String(READER_ID);
  realtime.addChangesListener("Relay", "UPDATE", "public", filter);
  realtime.listen();

  lcd.init();
  lcd.backlight();

  byte lockChar[8] = {0b01110, 0b10001, 0b10001, 0b11111, 0b11011, 0b11011, 0b11111, 0b00000};
  byte checkChar[8] = {0b00000, 0b00001, 0b00011, 0b10110, 0b11100, 0b01000, 0b00000, 0b00000};
  lcd.createChar(1, lockChar);
  lcd.createChar(2, checkChar);

  updateLCD("ID: " + READER_ID, "STARTING...");
  
  // 3. QR
  QRSerial.begin(9600, SERIAL_8N1, QR_RX_PIN, QR_TX_PIN);
  Serial.println("[QR] Scanner initialized");

  // 4. PN532
  SPI.begin();
  nfc.begin();
  uint32_t versiondata = nfc.getFirmwareVersion();
  if (!versiondata) {
    Serial.println("[RFID] PN532 not detected!");
    pn532Available = false;
  } else {
    nfc.setPassiveActivationRetries(0x02); 
    if (nfc.SAMConfig()) {
      Serial.println("[RFID] Reader initialized");
      pn532Available = true;
    } else {
      Serial.println("[RFID] SAMConfig failed!");
      pn532Available = false;
    }
  }

  // 5. BLE (Immediate Independent Startup)
  initBLE();



  
  // 7. WIFI (Captive Portal & Watchdog)
    
  
  
  
  preferences.begin("focusx", false);
  String savedKey = preferences.getString("apikey", "");
  String savedReader = preferences.getString("readerid", "");
  
  if (savedKey != "") strncpy(HARDWARE_API_KEY, savedKey.c_str(), sizeof(HARDWARE_API_KEY));
  if (savedReader != "") READER_ID = savedReader;

  WiFiManager wm;
  wm.setConnectTimeout(30);
  
  WiFiManagerParameter custom_api_key("apikey", "Hardware API Key", HARDWARE_API_KEY, 64);
  WiFiManagerParameter custom_reader_id("readerid", "Reader ID", READER_ID.c_str(), 64);
  wm.addParameter(&custom_api_key);
  wm.addParameter(&custom_reader_id);

  
  // Custom FocusX UI for the Captive Portal
  const char* focusx_ui = R"rawliteral(
  <style>
    body { background-color: #F8FAFC; font-family: sans-serif; color: #0F172A; text-align: center; }
    .wrap { max-width: 400px; margin: 40px auto; padding: 30px; background: #FFFFFF; border-radius: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
    button { background-color: #0F766E; color: white; border: none; border-radius: 12px; padding: 14px 20px; font-size: 16px; font-weight: 600; width: 100%; cursor: pointer; transition: 0.2s; margin-top: 10px; }
    button:hover { background-color: #0D9488; }
    input { border: 2px solid #E2E8F0; border-radius: 12px; padding: 14px; font-size: 16px; width: 100%; box-sizing: border-box; margin-bottom: 16px; }
    h1 { color: #0F766E; font-size: 24px; text-align: center; font-weight: 800; }
  </style>
  <div style="text-align: center; margin-bottom: 20px;">
    <h1>FocusX Scanner</h1>
    <p style="color: #64748b;">Connect to Library Wi-Fi</p>
  </div>
  )rawliteral";
  
  wm.setCustomHeadElement(focusx_ui);

  updateLCD("WIFI SETUP", "CONNECT TO AP");
  if (!wm.autoConnect("FocusX Scanner")) {
    Serial.println("Failed to connect and hit timeout");
    delay(3000);
    ESP.restart();
  }

  // Initialize NTP time (UTC)
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  Serial.println("Waiting for NTP time sync...");
  time_t now = time(nullptr);
  int retries = 0;
  while (now < 8 * 3600 * 2 && retries < 15) {
    delay(500);
    Serial.print(".");
    now = time(nullptr);
    retries++;
  }
  Serial.println("");
  struct tm timeinfo;
  if (getLocalTime(&timeinfo)) {
    Serial.println("Time synced successfully!");
  }

  
  String newApiKey = String(custom_api_key.getValue());
  String newReaderId = String(custom_reader_id.getValue());
  if (newApiKey != "" && newApiKey != String(HARDWARE_API_KEY)) {
    preferences.putString("apikey", newApiKey);
    strncpy(HARDWARE_API_KEY, newApiKey.c_str(), sizeof(HARDWARE_API_KEY));
  }
  if (newReaderId != "" && newReaderId != READER_ID) {
    preferences.putString("readerid", newReaderId);
    READER_ID = newReaderId;
  }

  Serial.println("WIFI CONNECTED");


  currentState = STATE_IDLE;
  setIdleLCD();
}

// =================================================
// MAIN LOOP
// =================================================

// --- Hardware Ping ---
unsigned long lastPingTime = 0;

String getISOTime() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return "";
  }
  char buffer[30];
  // Format: 2026-10-02T10:15:00Z
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buffer);
}

void sendHardwarePing() {
  if (millis() - lastPingTime > 60000) {
    if (WiFi.status() == WL_CONNECTED && String(READER_ID) != "") {
      String isoTime = getISOTime();
      if (isoTime != "") {
        NetworkClientSecure client;
        client.setInsecure();
        HTTPClient http;
        String url = String(SUPABASE_URL) + "/rest/v1/Relay?bleReaderId=eq." + String(READER_ID);
        http.begin(client, url);
        http.addHeader("apikey", SUPABASE_ANON_KEY);
        http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
        http.addHeader("Content-Type", "application/json");
        http.addHeader("Prefer", "return=minimal");
        
        String payload = "{\"lastSeenAt\": \"" + isoTime + "\"}";
        int httpCode = http.PATCH(payload);
        if(httpCode == 200 || httpCode == 204) {
          Serial.println("[Supabase] Direct NTP Heartbeat success: " + isoTime);
        } else {
          Serial.println("[Supabase] Failed: " + String(httpCode));
        }
        http.end();
      } else {
        Serial.println("[Supabase] Skipping heartbeat, time not synced yet.");
      }
    }
    lastPingTime = millis();
  }
}


void checkToF() {
  if (myImager.isDataReady()) {
    VL53L5CX_ResultsData measurementData;
    if (myImager.getRangingData(&measurementData)) {
      int leftCount = 0;
      int rightCount = 0;
      for (int i = 0; i < 64; i++) {
        if (measurementData.target_status[i] == 5 || measurementData.target_status[i] == 9) {
          int distance = measurementData.distance_mm[i];
          if (distance > 0 && distance < 1000) {
            int col = i % 8;
            if (col < 4) leftCount++;
            else rightCount++;
          }
        }
      }
      
      int currentZone = 0;
      if (leftCount > 3 && rightCount <= 3) currentZone = 1;
      else if (rightCount > 3 && leftCount <= 3) currentZone = 2;
      else if (leftCount > 3 && rightCount > 3) currentZone = 3;

      if (currentZone != previousZone && currentZone != 0) {
        if (previousZone == 1 && currentZone == 2) {
          Serial.println("[ToF] Direction: IN -> OUT");
        } else if (previousZone == 2 && currentZone == 1) {
          Serial.println("[ToF] Direction: OUT -> IN");
          if (buzzerType == 0) triggerBuzzer(3);
        }
      }
      if (currentZone != 0) previousZone = currentZone;
      if (leftCount == 0 && rightCount == 0) previousZone = 0;
    }
  }
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) { realtime.loop(); }
  

  // 1. Maintain Background Services
  processBuzzer();
  sendHardwarePing();
  // checkIR(); 
  checkToF();

  // WiFi Reconnection Management (Non-Blocking)
  static unsigned long lastWifiCheck = 0;
  if (millis() - lastWifiCheck > 10000) {
    if (WiFi.status() != WL_CONNECTED) {
      WiFi.reconnect(); 
    }
    lastWifiCheck = millis();
  }

  // 2. State Machine
  switch (currentState) {
    
    case STATE_IDLE:
      if (millis() > gracePeriodEnd) {
        setArmedVisual();
      }
        // Breathing LED Logic on Built-in LED
  if (currentState == STATE_IDLE && millis() > gracePeriodEnd) {
    float val = (exp(sin(millis() / 1500.0 * PI)) - 0.36787944) * 108.0;
    analogWrite(BREATHING_LED_PIN, (int)val);
  } else {
    analogWrite(BREATHING_LED_PIN, 0);
  }

      checkRFID();
      checkQR();
      break;

        case STATE_AUTHORIZING:
      {
        AuthResponse res;
        if (xQueueReceive(authResponseQueue, &res, 0) == pdPASS) {
          processAuthResponse(res);
        }
      }
      break;

    case STATE_FEEDBACK:
      if (millis() - stateStartTime >= 2500) {
          if (pendingRetry) {
            preferences.begin("focusx", false);
            preferences.putBool("retryActive", false);
            preferences.end();
            pendingRetry = false;
            
            updateLCD("RECOVERING...", "PLEASE WAIT");
            delay(500);
            startAuthorization(pendingRetryPayload, pendingRetryScanType);
            return;
          }
        currentState = STATE_IDLE;
        setIdleLCD();
      }
      break;
      
    case STATE_INITIALIZING:
      break;
  }
}
