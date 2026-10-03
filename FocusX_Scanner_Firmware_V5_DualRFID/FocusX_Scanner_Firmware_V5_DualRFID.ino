volatile bool remoteOpenIn = false;
volatile bool remoteOpenOut = false;

#include <Wire.h>
#include <NimBLEDevice.h>
#include <NimBLEUtils.h>
#include <NimBLEServer.h>
#include <NimBLEBeacon.h>
#include <NimBLEAdvertising.h>
#include <LiquidCrystal_I2C.h>
#include <SPI.h>
#include <Adafruit_PN532.h>
#include <Adafruit_NeoPixel.h>
#include <WiFiManager.h>
#include <time.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>

// ================= SECRETS & CLOUD =================
char HARDWARE_API_KEY[64] = "my_secret_library_door_key_123";
String READER_ID = "";
const char* API_URL = "https://www.focusx.in/api/hardware/scan";
const char* SUPABASE_URL = "https://iiozcipbxsmjasgglsyf.supabase.co";
const char* SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpb3pjaXBieHNtamFzZ2dsc3lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzU1MjgsImV4cCI6MjA5NjE1MTUyOH0.V0TETykYX5KNAVOvaj039reZmURocfKac3voZrku-a0";

Preferences preferences;

// ================= RFID =================
#define PN532_SCK 19
#define PN532_MISO 15
#define PN532_MOSI 23
#define PN532_SS_1 4
#define PN532_SS_2 17

// ================= OTHER PINS =================
#define BUZZER_PIN 25
#define REED_PIN 32
#define LED_PIN 33
#define NUM_LEDS 5
#define RFID2_LED_PIN 26
#define RFID2_NUM_LEDS 5

// ================= OBJECTS =================
LiquidCrystal_I2C lcd(0x27, 16, 2);

Adafruit_PN532 nfc1(PN532_SCK, PN532_MISO, PN532_MOSI, PN532_SS_1);
Adafruit_PN532 nfc2(PN532_SCK, PN532_MISO, PN532_MOSI, PN532_SS_2);

Adafruit_NeoPixel strip(NUM_LEDS, LED_PIN, NEO_GRB + NEO_KHZ800);
Adafruit_NeoPixel rfid2Strip(RFID2_NUM_LEDS, RFID2_LED_PIN, NEO_GRB + NEO_KHZ800);

// ================= VARIABLES =================
bool userIsInside = false;
bool isGateOpen = false;
bool hasDoorOpenedDuringGrace = false;
unsigned long gateOpenStartTime = 0;

const int GRACE_PERIOD_MS = 7000;
const int MIN_OPEN_TIME_MS = 3000;
const int ALARM_RFID_GRACE_MS = 3000;
unsigned long doorOpenStartTime = 0;
bool isDoorRattling = false;
bool openedByRFID2 = false;

// ================= FREERTOS & AUTH =================
struct AuthRequest {
  char scanType[16];
  char payload[256];
  char eventId[64];
};

struct AuthResponse {
  int resultCode;
  char message[64];
  char direction[16];
};

QueueHandle_t authRequestQueue;
QueueHandle_t authResponseQueue;

unsigned long lastPingTime = 0;
unsigned long lastBLEPollTime = 0;

// ISRG Root X1 for HTTPS
const char* rootCACertificate = \
"-----BEGIN CERTIFICATE-----\n" \
"MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRnXubJIVHzAwDQYJKoZIhvcNAQELBQAw\n" \
"TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh\n" \
"cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4\n" \
"WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu\n" \
"ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY\n" \
"MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJ1yOObp98X0ZKAFf\n" \
"qjz21L4EKdPOUjO0d4UczfG+Jq7k3v6xW58K1+2a0Z14hF/t9E9sUj2EaO8c4Pcw\n" \
"t7j64Jd+e3a1Jm3G0y9QjJ7pM+8Gz9R1T/8YfQzI51/WJ6/f99O1X6J3Z3/dF/XW\n" \
"uQO5wX5uJ6/yL9X1U4tZ6HqV7B6X3xX6V5Q2a5A0E6s6B3Zz7sM7pA6aW5u7+A9W\n" \
"w/3Qx+9J2R2p1n2D5+4/1vU8X7/K3aY8+G4Vb4wW5t8Z5X/8R9X/wWw5Wb6E+A6F\n" \
"c7sQ/1o/1Hq9V8y9C1qX/6H/Y8/Y/M3W7G3P6X6U6W/1h6G/X6s6s+z+F2n8O/V7\n" \
"k6W/8T6V7W5A6a5/1X+7aX/4H7X5/2p5U6W/1H+6tX6/4e5X5/4A6T5+6tX6/4e5X\n" \
"5/4A6T5+6tX6/4e5X5/4A6T5+6tX6/4e5X5/4A6T5+6tX6/4e5X5/4A6T5+6tX6/4\n" \
"e5X5/4A6T5+6tX6/4e5X5/4A6T5+6tX6/4e5X5/4A6T5+6tX6/4e5X5/4A6T5+6t\n" \
"-----END CERTIFICATE-----\n";

// ================= CLOUD WORKER =================
void httpWorkerTask(void *pvParameters) {
    AuthRequest req;
    
    while (true) {
      // Wait infinitely for a scan (portMAX_DELAY) so it never loops pointlessly!
      if (xQueueReceive(authRequestQueue, &req, portMAX_DELAY) == pdPASS) {
        AuthResponse res;
        res.resultCode = 3;
        strncpy(res.message, "SERVER ERROR", sizeof(res.message)-1);
        res.message[sizeof(res.message)-1] = '\0';
  
        if (WiFi.status() == WL_CONNECTED) {
          // VERY IMPORTANT: Pause BLE advertising during WiFi/HTTPS requests!
          // WiFi and BLE share the same 2.4GHz antenna. If BLE is broadcasting, it drops WiFi SSL handshake packets!
          NimBLEDevice::getAdvertising()->stop();
          delay(50); // Let radio settle
          
          WiFiClientSecure client;
          client.setInsecure();
          HTTPClient http;
          
          if (http.begin(client, API_URL)) {
            http.addHeader("Content-Type", "application/json");
            http.addHeader("Authorization", String("Bearer ") + HARDWARE_API_KEY);
            http.setTimeout(8000);
  
            StaticJsonDocument<256> reqDoc;
            reqDoc["eventId"] = req.eventId;
            reqDoc["readerId"] = READER_ID.c_str();
            reqDoc["scanType"] = req.scanType;
            reqDoc["payload"] = req.payload;
            
            String requestBody;
            serializeJson(reqDoc, requestBody);
            
            Serial.print("Free Heap before POST: ");
            Serial.println(ESP.getFreeHeap());
            
            int httpCode = http.POST(requestBody);
            
            Serial.print("HTTP Code: ");
            Serial.println(httpCode);
  
            if (httpCode >= 200 && httpCode < 300) {
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
                         res.direction[15] = '\0';
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
            }
            http.end();
          } else {
            res.resultCode = 2; // HTTP Error
            strcpy(res.message, "HTTP BEGIN FAIL");
          }
          
          // Resume BLE advertising
          NimBLEDevice::getAdvertising()->start();
        }
        xQueueSend(authResponseQueue, &res, 0);
      }
    }
}

String getISOTime() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return "2026-01-01T00:00:00.000Z";
  }
  char timeStringBuff[50];
  strftime(timeStringBuff, sizeof(timeStringBuff), "%Y-%m-%dT%H:%M:%S.000Z", &timeinfo);
  return String(timeStringBuff);
}

void sendHardwarePing() {
  if (millis() - lastPingTime > 60000) {
    if (WiFi.status() == WL_CONNECTED && String(READER_ID) != "") {
      String isoTime = getISOTime();
      if (isoTime != "") {
        
        
        HTTPClient http;
        String url = String(SUPABASE_URL) + "/rest/v1/Relay?bleReaderId=eq." + String(READER_ID);
        WiFiClientSecure client; client.setInsecure(); http.begin(client, url);
        http.addHeader("apikey", SUPABASE_ANON_KEY);
        http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
        http.addHeader("Content-Type", "application/json");
        http.addHeader("Prefer", "return=minimal");
        
        String payload = "{\"lastSeenAt\": \"" + isoTime + "\"}";
        http.PATCH(payload);
        http.end();
      }
    }
    lastPingTime = millis();
  }
}








// ================= BLE BEACON =================

// ================= BLE GATT =================

#define SERVICE_UUID        "87b99b2c-90fd-11e9-bc42-526af7764f64"
#define CHARACTERISTIC_UUID "87b99b2c-90fd-11e9-bc42-526af7764f65"

class MyServerCallbacks: public NimBLEServerCallbacks {
    void onConnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo) override {
      Serial.println("Phone connected via BLE!");
    }
    void onDisconnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo, int reason) override {
      Serial.println("Phone disconnected from BLE.");
      NimBLEDevice::startAdvertising();
    }
};

class MyCallbacks: public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic *pCharacteristic, NimBLEConnInfo& connInfo) override {
      std::string value = pCharacteristic->getValue();
      if (value.length() > 0) {
        if (value == "UNLOCK_IN") remoteOpenIn = true;
        else if (value == "UNLOCK_OUT") remoteOpenOut = true;
      }
    }
};

void initBLE() {
  NimBLEDevice::init("FocusX_Beacon");
  NimBLEServer *pServer = NimBLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  NimBLEService *pService = pServer->createService(SERVICE_UUID);
  NimBLECharacteristic *pCharacteristic = pService->createCharacteristic(
                                         CHARACTERISTIC_UUID,
                                         NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR
                                       );
  pCharacteristic->setCallbacks(new MyCallbacks());
  pService->start();

  NimBLEAdvertising *pAdvertising = NimBLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  
  uint8_t payload[25];
  payload[0] = 0x4C; // Apple LSB
  payload[1] = 0x00; // Apple MSB
  payload[2] = 0x02; // iBeacon Type
  payload[3] = 0x15; // Length
  uint8_t uuid[16] = {0x87, 0xb9, 0x9b, 0x2c, 0x90, 0xfd, 0x11, 0xe9, 0xbc, 0x42, 0x52, 0x6a, 0xf7, 0x76, 0x4f, 0x64};
  memcpy(&payload[4], uuid, 16);
  payload[20] = 0x00; // Major MSB
  payload[21] = 0x01; // Major LSB
  payload[22] = 0x00; // Minor MSB
  payload[23] = 0x01; // Minor LSB
  payload[24] = 0xC5; // TX Power
  
  NimBLEAdvertisementData oAdvertisementData = NimBLEAdvertisementData();
  oAdvertisementData.setFlags(0x06); // 0x06 ensures general discoverable and connectable
  oAdvertisementData.setManufacturerData(std::string((char*)payload, 25));
  
  pAdvertising->setAdvertisementData(oAdvertisementData);
  pAdvertising->start();
}

// ================= LED FUNCTIONS =================
void setLEDsColor(uint8_t r, uint8_t g, uint8_t b) {
  for (int i = 0; i < NUM_LEDS; i++) strip.setPixelColor(i, strip.Color(r, g, b));
  strip.show();
}
void setRFID2StripColor(uint8_t r, uint8_t g, uint8_t b) {
  for (int i = 0; i < RFID2_NUM_LEDS; i++) rfid2Strip.setPixelColor(i, rfid2Strip.Color(r, g, b));
  rfid2Strip.show();
}

void setAlarmLEDs(bool reversePattern) {
  for (int i = 0; i < NUM_LEDS; i++) strip.setPixelColor(i, reversePattern ? (i%2==0 ? strip.Color(0,0,255):strip.Color(255,0,0)) : (i%2==0 ? strip.Color(255,0,0):strip.Color(0,0,255)));
  strip.show();
}
void setRFID2AlarmLEDs(bool reversePattern) {
  for (int i = 0; i < RFID2_NUM_LEDS; i++) rfid2Strip.setPixelColor(i, reversePattern ? (i%2==0 ? rfid2Strip.Color(0,0,255):rfid2Strip.Color(255,0,0)) : (i%2==0 ? rfid2Strip.Color(255,0,0):rfid2Strip.Color(0,0,255)));
  rfid2Strip.show();
}

void playWelcomeChime() { tone(BUZZER_PIN, 1500, 150); delay(150); noTone(BUZZER_PIN); }
void playGoodbyeChime() { tone(BUZZER_PIN, 1500, 150); delay(150); noTone(BUZZER_PIN); }
void playDeniedChime() { tone(BUZZER_PIN, 300, 500); delay(500); noTone(BUZZER_PIN); }

void resetToIdle() {
  isGateOpen = false;
  hasDoorOpenedDuringGrace = false;
  openedByRFID2 = false;
  setLEDsColor(0, 0, 255);
  setRFID2StripColor(0, 0, 255);
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("SYSTEM ARMED");
  lcd.setCursor(0, 1); lcd.print("TAP YOUR CARD");
}

void greenCountdown() {
  unsigned long countdownStart = millis();
  while (millis() - countdownStart < 7000) {
    unsigned long elapsed = millis() - countdownStart;
    int ledsOn = 0;
    if (elapsed < 1400) ledsOn = 5;
    else if (elapsed < 2800) ledsOn = 4;
    else if (elapsed < 4200) ledsOn = 3;
    else if (elapsed < 5600) ledsOn = 2;
    else if (elapsed < 7000) ledsOn = 1;
    
    for (int i = 0; i < NUM_LEDS; i++) {
      if (i < ledsOn) strip.setPixelColor(i, strip.Color(0, 255, 0));
      else strip.setPixelColor(i, 0);
    }
    strip.show();
    noTone(BUZZER_PIN);
    delay(20);
  }
  setLEDsColor(0,0,0);
}

// ================= CHECK RFID =================
String readRFID(Adafruit_PN532 &nfc, int ss_enable, int ss_disable) {
  digitalWrite(ss_disable, HIGH);
  digitalWrite(ss_enable, LOW);
  uint8_t uid[7];
  uint8_t uidLength;
  bool success = nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 50);
  digitalWrite(ss_enable, HIGH);
  if (success) {
    String res = "";
    for(int i=0; i<uidLength; i++) res += String(uid[i], HEX);
    return res;
  }
  return "";
}

void doAuth(String uid, bool isExit) {
  setLEDsColor(255, 255, 0); // Yellow
  if (isExit) setRFID2StripColor(255, 255, 0);
  lcd.clear();
  lcd.setCursor(0,0); lcd.print("AUTHORIZING...");
  
  // DRAIN STALE RESPONSES FROM TIMEOUTS
  AuthResponse staleRes;
  while(xQueueReceive(authResponseQueue, &staleRes, 0) == pdPASS) {}
  
  AuthRequest req;
  strcpy(req.scanType, "rfid");
  strcpy(req.eventId, String(millis()).c_str());
  uid.toCharArray(req.payload, 255);
  
  xQueueSend(authRequestQueue, &req, 0);
  
  AuthResponse res;
  if (xQueueReceive(authResponseQueue, &res, 8000 / portTICK_PERIOD_MS) == pdPASS) {
    if (res.resultCode == 1) { // Success
      isGateOpen = true;
      gateOpenStartTime = millis();
      hasDoorOpenedDuringGrace = false;
      openedByRFID2 = isExit;
        if (String(res.direction) == "OUT") {
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
      delay(1000);
    } else { // Denied
      setLEDsColor(255, 0, 0);
      if (isExit) setRFID2StripColor(255, 0, 0);
      lcd.clear(); lcd.setCursor(0,0); lcd.print(res.message);
      playDeniedChime();
      delay(2000);
      resetToIdle();
    }
  } else {
    setLEDsColor(255, 0, 0);
    if (isExit) setRFID2StripColor(255, 0, 0);
    lcd.clear(); lcd.setCursor(0,0); lcd.print("NETWORK TIMEOUT");
    playDeniedChime();
    delay(2000);
    resetToIdle();
  }
}

// ================= ALARMS =================
void triggerAlarm() {
  lcd.clear(); lcd.setCursor(0,0); lcd.print("!!! WARNING !!!");
  lcd.setCursor(0,1); lcd.print("TAP CARD 3 SEC");
  unsigned long alarmStartTime = millis();
  unsigned long lastBlinkTime = 0;
  bool reversePattern = false;

  while (digitalRead(REED_PIN) == HIGH) {
    unsigned long currentTime = millis();
    if (currentTime - alarmStartTime <= ALARM_RFID_GRACE_MS) {
      String r1 = readRFID(nfc1, PN532_SS_1, PN532_SS_2);
      if (r1 != "") {
        noTone(BUZZER_PIN);
        doAuth(r1, false);
        return;
      }
    }
    tone(BUZZER_PIN, 2000);
    if (currentTime - lastBlinkTime >= 150) {
      lastBlinkTime = currentTime;
      setAlarmLEDs(reversePattern);
      setRFID2AlarmLEDs(reversePattern);
      reversePattern = !reversePattern;
    }
    delay(10);
  }
  noTone(BUZZER_PIN);
  resetToIdle();
}

void triggerDoorLeftOpenAlarm() {
  lcd.clear(); lcd.setCursor(0,0); lcd.print("DOOR LEFT OPEN!");
  lcd.setCursor(0,1); lcd.print("PLEASE CLOSE");
  bool reversePattern = false;
  unsigned long lastBlinkTime = 0;

  while (digitalRead(REED_PIN) == HIGH) {
    unsigned long currentTime = millis();
    if (currentTime - lastBlinkTime >= 150) {
      lastBlinkTime = currentTime;
      setAlarmLEDs(reversePattern);
      setRFID2AlarmLEDs(reversePattern);
      reversePattern = !reversePattern;
    }
    tone(BUZZER_PIN, 1800);
    delay(10);
  }
  noTone(BUZZER_PIN);
  resetToIdle();
}

// ================= SETUP =================
void setup() {
  Serial.begin(115200);
  delay(1000);

  WiFi.mode(WIFI_STA);
  READER_ID = WiFi.macAddress();
  READER_ID.replace(":", "");

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(REED_PIN, INPUT_PULLUP);
  pinMode(PN532_SS_1, OUTPUT);
  pinMode(PN532_SS_2, OUTPUT);
  digitalWrite(PN532_SS_1, HIGH);
  digitalWrite(PN532_SS_2, HIGH);

  strip.begin(); strip.show(); strip.setBrightness(100);
  rfid2Strip.begin(); rfid2Strip.show(); rfid2Strip.setBrightness(100);

  Wire.begin(5, 22);
  lcd.init(); lcd.backlight(); lcd.clear();
  lcd.setCursor(0,0); lcd.print("SYSTEM BOOTING");

  // NVS & WiFiManager
  preferences.begin("focusx", false);
  String savedKey = preferences.getString("apikey", "");
  String savedReader = preferences.getString("readerid", "");
  if (savedKey != "") strncpy(HARDWARE_API_KEY, savedKey.c_str(), sizeof(HARDWARE_API_KEY));
  if (savedReader != "") READER_ID = savedReader;
  
  WiFiManager wm;
  wm.setConnectTimeout(30);
  
  lcd.setCursor(0,1); lcd.print("CONNECTING WIFI");
  if (!wm.autoConnect("FocusX Scanner")) {
    Serial.println("Failed to connect and hit timeout");
    ESP.restart();
  }
  
  // Set Reader ID to strictly match the mobile app's hardcoded POC
  READER_ID = "87b99b2c-90fd-11e9-bc42-526af7764f64:1:1";
  
  // PIN-based setup logic
  lcd.clear(); lcd.setCursor(0,0); lcd.print("CHECKING CLAIM");
    
  bool isClaimed = false;
  
  // 1. Check if already claimed
  {
    WiFiClientSecure client; 
    client.setInsecure(); 
    HTTPClient http;
    if (http.begin(client, "https://www.focusx.in/api/hardware/check-pin")) {
      http.addHeader("Content-Type", "application/json");
      int code = http.POST("{\"mac\":\"" + String(READER_ID) + "\"}");
      if (code == 200) {
        String response = http.getString();
        if (response.indexOf("\"claimed\":true") != -1 || response.indexOf("\"claimed\": true") != -1) {
          isClaimed = true;
        }
      }
      http.end();
    }
  }
  
  if (!isClaimed) {
    // Generate PIN
    String pin = String(random(100000, 999999));
    
    // 2. Register PIN
    {
      WiFiClientSecure client; 
      client.setInsecure(); 
      HTTPClient http;
      if (http.begin(client, "https://www.focusx.in/api/hardware/register-pin")) {
        http.addHeader("Content-Type", "application/json");
        http.POST("{\"pin\":\"" + pin + "\",\"mac\":\"" + String(READER_ID) + "\",\"readerId\":\"" + String(READER_ID) + "\"}");
        http.end();
      }
    }
    
    lcd.clear(); lcd.setCursor(0,0); lcd.print("CLAIM DEVICE PIN");
    lcd.setCursor(0,1); lcd.print(pin);
    
    // 3. Poll until claimed
    while (!isClaimed) {
      delay(3000);
      {
        WiFiClientSecure client; 
        client.setInsecure(); 
        HTTPClient http;
        if (http.begin(client, "https://www.focusx.in/api/hardware/check-pin?pin=" + pin)) {
          int code = http.GET();
          if (code == 200) {
            String response = http.getString();
            if (response.indexOf("\"isClaimed\":true") != -1 || response.indexOf("\"isClaimed\": true") != -1) {
              isClaimed = true;
            }
          }
          http.end();
        }
      }
    }
    
    lcd.clear(); lcd.setCursor(0,0); lcd.print("DEVICE CLAIMED!");
    delay(3000);
    
    // Reboot after claiming to cleanly reset memory
    ESP.restart();
  }
  preferences.end();

  // NTP Time
  configTime(0, 0, "pool.ntp.org");
  lcd.clear(); lcd.setCursor(0,0); lcd.print("SYNCING CLOUD");
  
  // Start BLE *after* WiFi is fully connected!
  initBLE();

  // Cloud Queues
  authRequestQueue = xQueueCreate(10, sizeof(AuthRequest));
  authResponseQueue = xQueueCreate(10, sizeof(AuthResponse));
  xTaskCreatePinnedToCore(httpWorkerTask, "HTTP", 16384, NULL, 1, NULL, 1);

  
  // Initialize PN532
  SPI.begin();
  nfc1.begin();
  if (!nfc1.getFirmwareVersion()) {
    lcd.clear(); lcd.print("RFID 1 ERROR");
    while(1);
  }
  nfc1.setPassiveActivationRetries(0x02); nfc1.SAMConfig();

  nfc2.begin();
  if (!nfc2.getFirmwareVersion()) {
    lcd.clear(); lcd.print("RFID 2 ERROR");
    while(1);
  }
  nfc2.setPassiveActivationRetries(0x02); nfc2.SAMConfig();

  resetToIdle();
}

// ================= LOOP =================
void loop() {
  
  sendHardwarePing();
  
  unsigned long currentMillis = millis();
  bool doorState = digitalRead(REED_PIN);

  if (!isGateOpen && doorState == HIGH) {
    if (!isDoorRattling) {
      isDoorRattling = true;
      doorOpenStartTime = currentMillis;
    }
    if (currentMillis - doorOpenStartTime > 150) {
      triggerAlarm();
      isDoorRattling = false;
    }
  } else {
    isDoorRattling = false;
  }

  if (isGateOpen) {
    unsigned long timePassed = currentMillis - gateOpenStartTime;
    if (doorState == HIGH) hasDoorOpenedDuringGrace = true;

    if (timePassed > MIN_OPEN_TIME_MS && hasDoorOpenedDuringGrace && doorState == LOW) {
      resetToIdle(); return;
    }

    if (timePassed > GRACE_PERIOD_MS) {
      if (doorState == LOW) { resetToIdle(); return; }
      else { triggerDoorLeftOpenAlarm(); return; }
    }

    uint32_t countdownColor = openedByRFID2 ? strip.Color(255, 80, 0) : strip.Color(0, 255, 0);
    int ledsOn = 0;
    if (timePassed < 1400) ledsOn = 5;
    else if (timePassed < 2800) ledsOn = 4;
    else if (timePassed < 4200) ledsOn = 3;
    else if (timePassed < 5600) ledsOn = 2;
    else if (timePassed < 7000) ledsOn = 1;
    
    for (int i = 0; i < NUM_LEDS; i++) {
      if (i < ledsOn) strip.setPixelColor(i, countdownColor);
      else strip.setPixelColor(i, 0);
    }
    strip.show();
  }

  if (remoteOpenIn || remoteOpenOut) {
    bool isExitCmd = remoteOpenOut;
    remoteOpenIn = false;
    remoteOpenOut = false;
    
    isGateOpen = true;
    gateOpenStartTime = millis();
    hasDoorOpenedDuringGrace = false;
    openedByRFID2 = isExitCmd;
    
    if (isExitCmd) {
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
  }

  if (remoteOpenIn || remoteOpenOut) {
    bool isExitCmd = remoteOpenOut;
    remoteOpenIn = false;
    remoteOpenOut = false;
    
    isGateOpen = true;
    gateOpenStartTime = millis();
    hasDoorOpenedDuringGrace = false;
    openedByRFID2 = isExitCmd;
    
    if (isExitCmd) {
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
  }

  if (!isGateOpen && doorState == LOW) {
    String r1 = readRFID(nfc1, PN532_SS_1, PN532_SS_2);
    if (r1 != "") doAuth(r1, false);

    if (!isGateOpen) { // Check RFID2 if 1 didn't open it
      String r2 = readRFID(nfc2, PN532_SS_2, PN532_SS_1);
      if (r2 != "") doAuth(r2, true);
    }
  }

  delay(20);
}
