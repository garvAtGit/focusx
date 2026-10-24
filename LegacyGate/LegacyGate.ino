#include <WiFi.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <SPI.h>
#include <Adafruit_PN532.h>

// ==========================================
// 1. PIN DEFINITIONS
// ==========================================
#define PN532_SCK  18
#define PN532_MISO 19
#define PN532_MOSI 23
#define PN532_SS   5   // Using D5 because Relay is on D4

#define RELAY_PIN  4
// QR Scanner automatically uses Hardware Serial 2 (RX2=16, TX2=17)

// ==========================================
// 2. HARDWARE INITIALIZATION
// ==========================================
LiquidCrystal_I2C lcd(0x27, 16, 2); 
Adafruit_PN532 nfc(PN532_SCK, PN532_MISO, PN532_MOSI, PN532_SS);

const int UNLOCK_TIME_MS = 5000; // Relay open duration

// API CONFIGURATION
const char* API_URL = "https://www.focusx.in/api/hardware/scan";
const char* API_KEY = "my_secret_library_door_key_123"; 

void connectWiFi() {
  lcd.clear();
  lcd.print("WiFi Connect...");
  
  WiFiManager wm;
  // wm.resetSettings(); // Un-comment to reset settings
  
  bool res = wm.autoConnect("FocusX_Gate_AP");
  
  if (!res) {
    lcd.setCursor(0, 1);
    lcd.print("WiFi FAIL");
    delay(3000);
    ESP.restart();
  } 
  else {
    lcd.setCursor(0, 1);
    lcd.print("WiFi OK");
  }
  delay(1000);
}

// ==========================================
// 3. SETUP
// ==========================================
void setup() {
  Serial.begin(115200);
  
  // Initialize QR Scanner (Standard baud rate is 9600)
  Serial2.begin(9600, SERIAL_8N1, 16, 17);
  
  // Initialize Relay
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW); 
  
  lcd.init(); 
  lcd.backlight(); 
  lcd.print("BOOTING...");
  
  connectWiFi();

  nfc.begin();
  if (!nfc.getFirmwareVersion()) { 
    lcd.clear(); lcd.print("NFC ERROR!"); 
    while(1); 
  }
  
  // Required so NFC polling doesn't freeze the loop
  nfc.setPassiveActivationRetries(0x02); 
  nfc.SAMConfig();
  
  lcd.clear(); 
  lcd.setCursor(0, 0); lcd.print("SYSTEM READY");
  lcd.setCursor(0, 1); lcd.print("SCAN QR OR CARD");
}

bool verifyAccess(String scanType, String payload) {
  if (WiFi.status() != WL_CONNECTED) {
    lcd.clear();
    lcd.print("NO WIFI");
    delay(2000);
    return false;
  }

  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + API_KEY);

  StaticJsonDocument<256> doc;
  doc["eventId"] = String(millis());
  doc["readerId"] = WiFi.macAddress();
  doc["scanType"] = scanType;
  doc["payload"] = payload;

  String requestBody;
  serializeJson(doc, requestBody);

  lcd.clear();
  lcd.print("VERIFYING...");

  int httpResponseCode = http.POST(requestBody);
  bool granted = false;

  if (httpResponseCode > 0) {
    String response = http.getString();
    StaticJsonDocument<256> resDoc;
    deserializeJson(resDoc, response);

    if (httpResponseCode == 200) {
      String status = resDoc["status"];
      if (status == "ALLOW") {
        granted = true;
      } else {
        lcd.clear();
        lcd.print("DENIED:");
        lcd.setCursor(0, 1);
        String msg = resDoc["message"];
        lcd.print(msg.substring(0, 16));
        delay(2000);
      }
    } else {
      lcd.clear();
      lcd.print("HTTP ERROR ");
      lcd.print(httpResponseCode);
      delay(2000);
    }
  } else {
    lcd.clear();
    lcd.print("NET ERROR");
    delay(2000);
  }

  http.end();
  return granted;
}

// ==========================================
// 4. MAIN LOOP
// ==========================================
void loop() {
  bool localTriggered = false;
  String accessMethod = "";
  String payload = "";
  String type = "";

  // ---------------------------------------------------------
  // EVENT 1: CARD TAPPED
  // ---------------------------------------------------------
  uint8_t uid[] = {0,0,0,0,0,0,0};
  uint8_t uidLength;
  
  if (nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength)) {
    type = "RFID";
    for (uint8_t i = 0; i < uidLength; i++) {
      if (uid[i] < 0x10) payload += "0";
      payload += String(uid[i], HEX);
    }
    payload.toUpperCase();
    localTriggered = true;
    accessMethod = "CARD TAPPED!";
  } 
  
  // ---------------------------------------------------------
  // EVENT 2: QR SCANNED
  // ---------------------------------------------------------
  else if (Serial2.available() > 0) {
    delay(50); // Wait for entire QR string to buffer
    
    payload = Serial2.readString();
    payload.trim(); // Remove newlines
    
    type = "QR";
    localTriggered = true;
    accessMethod = "QR SCANNED!";
  }

  // ---------------------------------------------------------
  // EXECUTE UNLOCK (IF AUTHORIZED)
  // ---------------------------------------------------------
  if (localTriggered) {
    bool authorized = verifyAccess(type, payload);
    
    if (authorized) {
      lcd.clear(); 
      lcd.setCursor(0, 0); lcd.print("ACCESS GRANTED");
      lcd.setCursor(0, 1); lcd.print(accessMethod);
      
      digitalWrite(RELAY_PIN, HIGH); 
      delay(UNLOCK_TIME_MS); 
      digitalWrite(RELAY_PIN, LOW); 
    }
    
    lcd.clear(); 
    lcd.setCursor(0, 0); lcd.print("SYSTEM READY");
    lcd.setCursor(0, 1); lcd.print("SCAN QR OR CARD");
  }
}
