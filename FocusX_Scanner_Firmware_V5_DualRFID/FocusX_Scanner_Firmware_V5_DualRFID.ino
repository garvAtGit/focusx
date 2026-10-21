volatile bool shouldStartBLE = false;
struct BleAuthItem {
  char uid[40];
  bool isExit;
};
QueueHandle_t bleAuthQueue = NULL;

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
#include <LittleFS.h>
#include <FS.h>
#include <vector>
#include <PubSubClient.h>
#include "mbedtls/md.h"
#include "esp_sntp.h"
#include "esp_rom_gpio.h"
#include <esp_task_wdt.h>

// Task Watchdog Timer: 30-second timeout provides ample headroom for legitimate
// 12-15s HTTP timeouts without false panics while guaranteeing recovery if SPI bus or TLS deadlocks.
#define TWDT_TIMEOUT_S 30
struct AuthCredential {
  char uid[40];
  char userKey[40];
  uint32_t validFrom;
  uint32_t validUntil;
  bool isInside;
};
std::vector<AuthCredential> authSnapshot;

struct ScanEvent {
  uint32_t seqNo;
  String eventId;
  String scanType;
  String payload;
  unsigned long timestampMs;
  uint32_t timestampUnix;
  uint32_t authRevision;
  bool offlineDecision;
  bool isExit;
};

enum ClockState { CLOCK_UNKNOWN, CLOCK_SYNCED, CLOCK_STALE };
ClockState clockState = CLOCK_UNKNOWN;
uint32_t lastNtpSyncMs = 0;
uint32_t highestTrustedTime = 0;
char deviceSecret[65] = {0};

struct PublicKeyEntry {
  const char* keyId;
  const char* pem;
};

const char* SNAPSHOT_PUBLIC_KEY_K1 = 
"-----BEGIN PUBLIC KEY-----\n"
"MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEW/PFKOgkA5hCa8UX9Hvvd2zhwBZw\n"
"dEUzSEUpsDMlhztFicJt02ZPe/nH5wiRFhG3bKlwEFk9ejlEJ9By7/w5YQ==\n"
"-----END PUBLIC KEY-----\n";

const PublicKeyEntry TRUSTED_SNAPSHOT_KEYS[] = {
  { "k1", SNAPSHOT_PUBLIC_KEY_K1 }
};
const size_t NUM_TRUSTED_KEYS = sizeof(TRUSTED_SNAPSHOT_KEYS) / sizeof(TRUSTED_SNAPSHOT_KEYS[0]);

const char* getPublicKeyForKid(const String &kid) {
  for (size_t i = 0; i < NUM_TRUSTED_KEYS; i++) {
    if (kid.equals(TRUSTED_SNAPSHOT_KEYS[i].keyId)) {
      return TRUSTED_SNAPSHOT_KEYS[i].pem;
    }
  }
  return NULL;
}

bool snapshotIsValid = false;
uint32_t currentAuthRevision = 0;
String currentLibraryId = "";
String activeSlot = "A";
unsigned long lastSyncAttemptMs = 0;
unsigned long syncBackoffIntervalMs = 60000;
#define MAX_SNAPSHOT_SIZE 65536
WiFiClient mqttWiFiClient;
PubSubClient mqttClient(mqttWiFiClient);
#define ENABLE_MQTT false
const char* mqtt_server = "broker.hivemq.com"; // Unauthenticated public MQTT broker disabled in production


// ================= SECRETS & CLOUD =================
char HARDWARE_API_KEY[64] = "my_secret_library_door_key_123";
String READER_ID = "87b99b2c-90fd-11e9-bc42-526af7764f64:1:1";
const char* BACKEND_BASE_URL = "https://www.focusx.in";
const char* API_URL = "https://www.focusx.in/api/hardware/scan";
const char* SUPABASE_URL = "https://iiozcipbxsmjasgglsyf.supabase.co";
const char* SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpb3pjaXBieHNtamFzZ2dsc3lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzU1MjgsImV4cCI6MjA5NjE1MTUyOH0.V0TETykYX5KNAVOvaj039reZmURocfKac3voZrku-a0";

Preferences preferences;

// ================= RFID & PERIPHERAL PINOUT =================
#if defined(CONFIG_IDF_TARGET_ESP32S3) || defined(ARDUINO_ESP32S3_DEV)
// ESP32-S3 Physical Hardware Pinout:
// Verified physical wiring: LCD I2C is connected to SDA=4 and SCL=5
#define I2C_SDA_PIN 4
#define I2C_SCL_PIN 5

// PN532 SPI Pinout:
#define PN532_SCK 12
#define PN532_MISO 13
#define PN532_MOSI 11
#define PN532_SS_1 10
#define PN532_SS_2 14

// Status LEDs:
#define LED_PIN 6
#define NUM_LEDS 5
#define RFID2_LED_PIN 7
#define RFID2_NUM_LEDS 5

// Buzzer & Reed switch disabled (-1) to avoid pin conflicts with I2C lines 4 & 5
#define BUZZER_PIN -1
#define REED_PIN -1

// Voice Speaker Serial (Hardware UART1 on board TX pin 43, RX disconnected)
#define VOICE_TX_PIN 43
#define VOICE_RX_PIN -1
#define VOICE_BAUD 9600
#else
// Classic ESP32 Pinout
#define PN532_SCK 19
#define PN532_MISO 15
#define PN532_MOSI 23
#define PN532_SS_1 4
#define PN532_SS_2 17

#define BUZZER_PIN 25
#define REED_PIN 32
#define LED_PIN 33
#define NUM_LEDS 5
#define RFID2_LED_PIN 26
#define RFID2_NUM_LEDS 5

#define I2C_SDA_PIN 4
#define I2C_SCL_PIN 5
#endif

// Peripheral availability tracking
bool nfc1Available = false;
bool nfc2Available = false;
bool reedSwitchEnabled = true;

struct SafeLCD {
  LiquidCrystal_I2C* realLcd;
  bool available;
  uint8_t detectedAddr;
  SafeLCD() : realLcd(nullptr), available(false), detectedAddr(0) {}
  
  void init() {
    detectedAddr = 0;
    available = false;

    // Check physical pin states & perform bus recovery if line was held low
    pinMode(I2C_SDA_PIN, INPUT_PULLUP);
    pinMode(I2C_SCL_PIN, OUTPUT);
    for (int i = 0; i < 9; i++) {
      digitalWrite(I2C_SCL_PIN, HIGH);
      delayMicroseconds(5);
      digitalWrite(I2C_SCL_PIN, LOW);
      delayMicroseconds(5);
    }
    pinMode(I2C_SCL_PIN, INPUT_PULLUP);
    delay(10);

    int sdaVal = digitalRead(I2C_SDA_PIN);
    int sclVal = digitalRead(I2C_SCL_PIN);
    Serial.printf("[SafeLCD] Pin states: SDA(GPIO %d)=%s, SCL(GPIO %d)=%s\n", 
                  I2C_SDA_PIN, sdaVal ? "HIGH" : "LOW", 
                  I2C_SCL_PIN, sclVal ? "HIGH" : "LOW");

    Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
    Wire.setClock(100000);
    Wire.setTimeOut(25);
    
    // 1. Probe primary standard LCD backpack default addresses:
    // 0x27 (PCF8574 default), 0x3F (PCF8574A/AT default)
    const uint8_t primaryAddrs[] = { 0x27, 0x3F };
    for (size_t i = 0; i < sizeof(primaryAddrs); i++) {
      uint8_t addr = primaryAddrs[i];
      Serial.printf("[SafeLCD] Probing primary 0x%02X...\n", addr);
      Wire.beginTransmission(addr);
      uint8_t err = Wire.endTransmission();
      Serial.printf("[SafeLCD] 0x%02X endTransmission returned %d\n", addr, err);
      if (err == 0) {
        detectedAddr = addr;
        break;
      }
    }
    
    // 2. If not at defaults, probe alternate valid PCF8574 / PCF8574A jumper configurations only:
    if (detectedAddr == 0) {
      const uint8_t alternateAddrs[] = { 
        0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26,
        0x38, 0x39, 0x3A, 0x3B, 0x3C, 0x3D, 0x3E
      };
      for (size_t i = 0; i < sizeof(alternateAddrs); i++) {
        uint8_t addr = alternateAddrs[i];
        Serial.printf("[SafeLCD] Probing alternate 0x%02X...\n", addr);
        Wire.beginTransmission(addr);
        uint8_t err = Wire.endTransmission();
        Serial.printf("[SafeLCD] 0x%02X endTransmission returned %d\n", addr, err);
        if (err == 0) {
          detectedAddr = addr;
          break;
        }
      }
    }
    
    if (detectedAddr != 0) {
      if (realLcd) delete realLcd;
      realLcd = new LiquidCrystal_I2C(detectedAddr, 16, 2);
      if (realLcd) {
        realLcd->init();
        // LiquidCrystal_I2C::init() calls Wire.begin() with no args, clobbering custom pins!
        // Re-attach Wire to custom SDA/SCL pins immediately:
        Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
        realLcd->backlight();
        realLcd->clear();
        available = true;
        Serial.printf("[HARDWARE] I2C LCD backpack detected at 0x%02X and initialized successfully.\n", detectedAddr);
      }
    } else {
      available = false;
      Serial.println("[HARDWARE] No I2C LCD backpack detected at PCF8574 addresses (0x20-0x27, 0x38-0x3F). Operating in headless mode.");
    }
  }
  
  void backlight() { if (available && realLcd) realLcd->backlight(); }
  void clear() { if (available && realLcd) realLcd->clear(); }
  void setCursor(uint8_t col, uint8_t row) { if (available && realLcd) realLcd->setCursor(col, row); }
  template<typename T> void print(T val) { if (available && realLcd) realLcd->print(val); }
};
SafeLCD lcd;

Adafruit_PN532 nfc1(PN532_SCK, PN532_MISO, PN532_MOSI, PN532_SS_1);
Adafruit_PN532 nfc2(PN532_SCK, PN532_MISO, PN532_MOSI, PN532_SS_2);

Adafruit_NeoPixel strip(NUM_LEDS, LED_PIN, NEO_GRB + NEO_KHZ800);
Adafruit_NeoPixel rfid2Strip(RFID2_NUM_LEDS, RFID2_LED_PIN, NEO_GRB + NEO_KHZ800);

// ================= VARIABLES =================
bool isSystemOnline = true;
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
const char* rootCACertificate =
"-----BEGIN CERTIFICATE-----\n"
"MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw\n"
"TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh\n"
"cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4\n"
"WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu\n"
"ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY\n"
"MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc\n"
"h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+\n"
"0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U\n"
"A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW\n"
"T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH\n"
"B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC\n"
"B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv\n"
"KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn\n"
"OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn\n"
"jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw\n"
"qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI\n"
"rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV\n"
"HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq\n"
"hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL\n"
"ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ\n"
"3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK\n"
"NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5\n"
"ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur\n"
"TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC\n"
"jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc\n"
"oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq\n"
"4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA\n"
"mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d\n"
"emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=\n"
"-----END CERTIFICATE-----\n";

unsigned long bootCount = 0;
uint32_t currentSeqNo = 0;
bool hasMoreOnFlash = false;



std::vector<ScanEvent> pendingEvents;
portMUX_TYPE queueMutex = portMUX_INITIALIZER_UNLOCKED;

void reloadJournal() {
  File file = LittleFS.open("/journal.txt", "r");
  if (!file) {
    hasMoreOnFlash = false;
    return;
  }

  portENTER_CRITICAL(&queueMutex);
  pendingEvents.clear();
  portEXIT_CRITICAL(&queueMutex);

  std::vector<String> ackedIds;
  while (file.available()) {
    String line = file.readStringUntil('\n');
    line.trim();
    if (line.startsWith("ACK ")) {
      ackedIds.push_back(line.substring(4));
    }
  }

  file.seek(0);
  hasMoreOnFlash = false;
  uint32_t maxSeq = 0;

  while (file.available()) {
    String line = file.readStringUntil('\n');
    line.trim();
    if (line.startsWith("ADD ")) {
      int s1 = line.indexOf(' ', 4);
      int s2 = line.indexOf(' ', s1 + 1);
      int s3 = line.indexOf(' ', s2 + 1);
      int s4 = line.indexOf(' ', s3 + 1);
      int s5 = line.indexOf(' ', s4 + 1);
      int s6 = line.indexOf(' ', s5 + 1);
      int s7 = line.indexOf(' ', s6 + 1);
      int s8 = line.indexOf(' ', s7 + 1);
      int s9 = line.indexOf(' ', s8 + 1);

      if (s1 > 0 && s9 > 0) {
        String eventId = line.substring(s1 + 1, s2);
        uint32_t seq = line.substring(4, s1).toInt();
        if (seq > maxSeq) maxSeq = seq;

        bool isAcked = false;
        for (const auto& ackId : ackedIds) {
          if (ackId == eventId) {
            isAcked = true;
            break;
          }
        }

        if (!isAcked) {
          portENTER_CRITICAL(&queueMutex);
          bool hasRoom = pendingEvents.size() < 500;
          portEXIT_CRITICAL(&queueMutex);
          
          if (hasRoom) {
            ScanEvent e;
            e.seqNo = seq;
            e.eventId = eventId;
            e.scanType = line.substring(s2 + 1, s3);
            e.payload = line.substring(s3 + 1, s4);
            e.timestampMs = line.substring(s4 + 1, s5).toInt();
            e.isExit = line.substring(s5 + 1, s6).toInt() == 1;
            e.timestampUnix = line.substring(s6 + 1, s7).toInt();
            e.authRevision = line.substring(s7 + 1, s8).toInt();
            e.offlineDecision = line.substring(s8 + 1, s9).toInt() == 1;

            uint32_t crc_read = line.substring(s9 + 1).toInt();
            uint32_t crc_calc = 0;
            String content = line.substring(4, s9);
            for(int i=0; i<content.length(); i++) crc_calc += content[i];

            if (crc_read == crc_calc) {
              portENTER_CRITICAL(&queueMutex);
              pendingEvents.push_back(e);
              portEXIT_CRITICAL(&queueMutex);
            }
          } else {
            hasMoreOnFlash = true;
          }
        }
      }
    }
  }
  if (maxSeq > currentSeqNo) currentSeqNo = maxSeq;
  file.close();

  portENTER_CRITICAL(&queueMutex);
  bool isEmpty = pendingEvents.empty();
  portEXIT_CRITICAL(&queueMutex);

  if (isEmpty && !hasMoreOnFlash) {
    LittleFS.remove("/journal.txt");
  }
}


bool verifyAndParseSnapshot(const String &payload, uint32_t &outRev, std::vector<AuthCredential> &outVec, String &outLib, String &outDev, String &outSec) {
  if (payload.length() == 0 || payload.length() > MAX_SNAPSHOT_SIZE) return false;
  
  int fmtVersion = 0;
  String keyId = "";
  String devScope = "";
  String libScope = "";
  uint32_t rev = 0;
  String sec = "";
  std::vector<AuthCredential> vec;
  bool endMarkerFound = false;
  String expectedSigHex = "";
  
  mbedtls_md_context_t ctx;
  mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 0);
  mbedtls_md_starts(&ctx);
  
  int startIdx = 0;
  int payloadLen = payload.length();
  bool sigParsed = false;
  int lineCount = 0;
  
  while (startIdx < payloadLen) {
    lineCount++;
    if (lineCount % 10 == 0) {
      vTaskDelay(1);
    }
    int nextNewline = payload.indexOf('\n', startIdx);
    String rawLine;
    if (nextNewline == -1) {
      rawLine = payload.substring(startIdx);
      startIdx = payloadLen;
    } else {
      rawLine = payload.substring(startIdx, nextNewline);
      startIdx = nextNewline + 1;
    }
    
    // Canonicalize line ending (strip \r if present)
    if (rawLine.endsWith("\r")) {
      rawLine = rawLine.substring(0, rawLine.length() - 1);
    }
    
    if (rawLine.length() == 0) {
      if (sigParsed) break;
      mbedtls_md_free(&ctx);
      return false;
    }
    
    if (sigParsed) {
      rawLine.trim();
      if (rawLine.length() == 0) break;
      mbedtls_md_free(&ctx);
      return false;
    }
    
    if (rawLine.startsWith("SIG ")) {
      if (!endMarkerFound) {
        mbedtls_md_free(&ctx);
        return false;
      }
      expectedSigHex = rawLine.substring(4);
      expectedSigHex.trim();
      sigParsed = true;
      continue; // SIG line is NOT hashed into ctx
    }
    
    // Hash line into SHA256 context with canonical \n
    String canonicalLine = rawLine + "\n";
    mbedtls_md_update(&ctx, (const unsigned char*)canonicalLine.c_str(), canonicalLine.length());
    
    String line = rawLine;
    
    if (line.startsWith("FMT ")) {
      fmtVersion = line.substring(4).toInt();
    } else if (line.startsWith("KID ")) {
      keyId = line.substring(4);
      keyId.trim();
    } else if (line.startsWith("DEV ")) {
      devScope = line.substring(4);
      devScope.trim();
    } else if (line.startsWith("LIB ")) {
      libScope = line.substring(4);
      libScope.trim();
    } else if (line.startsWith("REV ")) {
      rev = (uint32_t)line.substring(4).toInt();
    } else if (line.startsWith("SEC ")) {
      sec = line.substring(4);
      sec.trim();
    } else if (line.startsWith("ADD ")) {
      int s1 = line.indexOf(' ', 4);
      int s2 = line.indexOf(' ', s1 + 1);
      int s3 = line.indexOf(' ', s2 + 1);
      if (s1 > 0 && s2 > 0 && s3 > 0) {
        AuthCredential cred;
        String uidStr = line.substring(4, s1);
        if (uidStr.length() > 39) {
          mbedtls_md_free(&ctx);
          return false;
        }
        strncpy(cred.uid, uidStr.c_str(), 39);
        cred.uid[39] = '\0';
        cred.validFrom = (uint32_t)line.substring(s1 + 1, s2).toInt();
        cred.validUntil = (uint32_t)line.substring(s2 + 1, s3).toInt();
        
        int s4 = line.indexOf(' ', s3 + 1);
        if (s4 > 0) {
          cred.isInside = (line.substring(s3 + 1, s4).toInt() == 1);
          String uKey = line.substring(s4 + 1);
          uKey.trim();
          strncpy(cred.userKey, uKey.c_str(), 39);
          cred.userKey[39] = '\0';
        } else {
          cred.isInside = (line.substring(s3 + 1).toInt() == 1);
          strncpy(cred.userKey, uidStr.c_str(), 39);
          cred.userKey[39] = '\0';
        }
        vec.push_back(cred);
      } else {
        mbedtls_md_free(&ctx);
        return false;
      }
    } else if (line.startsWith("END ")) {
      uint32_t endRev = (uint32_t)line.substring(4).toInt();
      if (endRev == rev && rev > 0) {
        endMarkerFound = true;
      } else {
        mbedtls_md_free(&ctx);
        return false;
      }
    } else {
      mbedtls_md_free(&ctx);
      return false;
    }
  }
  
  byte shaResult[32];
  mbedtls_md_finish(&ctx, shaResult);
  mbedtls_md_free(&ctx);
  
  // Strict structural and header checks
  if (fmtVersion != 1 && fmtVersion != 0) return false;
  if (!endMarkerFound || !sigParsed || expectedSigHex.length() == 0) return false;
  if (devScope.length() > 0 && !devScope.equals(READER_ID)) return false;
  if (libScope.length() == 0) return false;
  if (sec.length() > 0 && sec != "null" && sec.length() < 16) return false;
  if (keyId.length() == 0) keyId = "k1";
  
  const char* pubKeyPem = getPublicKeyForKid(keyId);
  if (!pubKeyPem) return false;
  
  if (expectedSigHex.length() % 2 != 0) return false;
  size_t sigLen = expectedSigHex.length() / 2;
  if (sigLen < 64 || sigLen > 128) return false;
  
  byte sigBytes[128];
  for (size_t i = 0; i < sigLen; i++) {
    char h1 = expectedSigHex.charAt(i * 2);
    char h2 = expectedSigHex.charAt(i * 2 + 1);
    if (!isxdigit(h1) || !isxdigit(h2)) return false;
    String byteStr = expectedSigHex.substring(i * 2, i * 2 + 2);
    sigBytes[i] = (byte)strtol(byteStr.c_str(), NULL, 16);
  }
  
  mbedtls_pk_context pk;
  mbedtls_pk_init(&pk);
  int parseRet = mbedtls_pk_parse_public_key(&pk, (const unsigned char*)pubKeyPem, strlen(pubKeyPem) + 1);
  if (parseRet != 0) {
    mbedtls_pk_free(&pk);
    return false;
  }
  
  int verifyRet = mbedtls_pk_verify(&pk, MBEDTLS_MD_SHA256, shaResult, 32, sigBytes, sigLen);
  mbedtls_pk_free(&pk);
  
  if (verifyRet != 0) return false;
  
  outRev = rev;
  outVec = vec;
  outLib = libScope;
  outDev = devScope;
  outSec = sec;
  return true;
}

bool tryLoadSnapshot(String filename, uint32_t &outRev, std::vector<AuthCredential> &outVec, String &outLib, String &outDev) {
  File file = LittleFS.open(filename, "r");
  if (!file) return false;
  
  size_t fSize = file.size();
  if (fSize == 0 || fSize > MAX_SNAPSHOT_SIZE) {
    file.close();
    return false;
  }
  
  String payload = file.readString();
  file.close();
  
  String secOut;
  bool ok = verifyAndParseSnapshot(payload, outRev, outVec, outLib, outDev, secOut);
  if (ok && secOut.length() > 0) {
    strncpy(deviceSecret, secOut.c_str(), 64);
    deviceSecret[64] = '\0';
  }
  return ok;
}


#define BLE_NONCE_CACHE_SIZE 64
struct BleNonceEntry {
  char nonce[12];
  uint32_t exp;
};
BleNonceEntry recentNonces[BLE_NONCE_CACHE_SIZE];
size_t nonceCount = 0;
portMUX_TYPE nonceMutex = portMUX_INITIALIZER_UNLOCKED;

void updateClockState() {
   time_t nowUnix = time(NULL);
   if (nowUnix < 1000000000) {
      clockState = CLOCK_UNKNOWN;
   } else {
      if ((uint32_t)nowUnix < highestTrustedTime) {
         // Security Guard: Clock Rollback Detected! Clock moved backward behind trusted high-water mark!
         clockState = CLOCK_STALE;
         Serial.println("SECURITY ALERT: Clock rollback detected (" + String((uint32_t)nowUnix) + " < " + String(highestTrustedTime) + ")");
      } else if (millis() - lastNtpSyncMs < 3600000) {
         clockState = CLOCK_SYNCED;
         highestTrustedTime = (uint32_t)nowUnix;
      } else {
         clockState = CLOCK_STALE;
      }
   }
}

void loadNoncesFromPreferences() {
  portENTER_CRITICAL(&nonceMutex);
  nonceCount = 0;
  String saved = preferences.getString("ble_nonces", "");
  uint32_t nowRef = (highestTrustedTime > 0) ? highestTrustedTime : (uint32_t)time(NULL);
  int start = 0;
  while (start < saved.length() && nonceCount < BLE_NONCE_CACHE_SIZE) {
    int comma = saved.indexOf(',', start);
    String entryStr = (comma == -1) ? saved.substring(start) : saved.substring(start, comma);
    entryStr.trim();
    int colon = entryStr.indexOf(':');
    if (colon > 0) {
      String n = entryStr.substring(0, colon);
      uint32_t e = (uint32_t)entryStr.substring(colon + 1).toInt();
      if (e >= nowRef && n.length() < 12) {
        strncpy(recentNonces[nonceCount].nonce, n.c_str(), 11);
        recentNonces[nonceCount].nonce[11] = '\0';
        recentNonces[nonceCount].exp = e;
        nonceCount++;
      }
    }
    if (comma == -1) break;
    start = comma + 1;
  }
  portEXIT_CRITICAL(&nonceMutex);
}

void saveNoncesToPreferences() {
  String out = "";
  portENTER_CRITICAL(&nonceMutex);
  for (size_t i = 0; i < nonceCount; i++) {
    out += String(recentNonces[i].nonce) + ":" + String(recentNonces[i].exp) + ",";
  }
  portEXIT_CRITICAL(&nonceMutex);
  preferences.putString("ble_nonces", out);
}

bool verifyBLEToken(String uid, String libId, String action, uint32_t iat, uint32_t exp, String nonce, String hmacHex) {
   // 1. Verify Clock is Trusted & Active
   updateClockState();
   if (clockState != CLOCK_SYNCED) {
     Serial.println("BLE Auth rejected: Clock not synced");
     return false;
   }
   
   // 2. Strict Clock Rollback Guard
   uint32_t nowUnix = (uint32_t)time(NULL);
   if (nowUnix < highestTrustedTime) {
     Serial.println("BLE Auth rejected: Clock behind highestTrustedTime (rollback)");
     return false;
   }
   
   // 3. Verify Expiration & Timing Window strictly
   if (nowUnix > exp) {
     Serial.println("BLE Auth rejected: Token expired");
     return false;
   }
   if (nowUnix < iat - 5) {
     Serial.println("BLE Auth rejected: Token future-dated");
     return false;
   }
   if (iat < highestTrustedTime - 35) {
     Serial.println("BLE Auth rejected: Token issued before trusted boundary");
     return false;
   }
   
   // 4. Verify Library Scope
   if (currentLibraryId.length() > 0 && !libId.equals(currentLibraryId)) {
     Serial.println("BLE Auth rejected: Library scope mismatch (" + libId + " != " + currentLibraryId + ")");
     return false;
   }
   
   // 5. Verify Action
   if (!action.equalsIgnoreCase("IN") && !action.equalsIgnoreCase("OUT") && !action.equalsIgnoreCase("CHECK_IN") && !action.equalsIgnoreCase("CHECK_OUT")) {
     Serial.println("BLE Auth rejected: Invalid action: " + action);
     return false;
   }

   // 6. Compute HMAC-SHA256 using deviceSecret
   if (strlen(deviceSecret) < 16) {
     Serial.println("BLE Auth rejected: Device secret not loaded");
     return false;
   }
   
   String payload = uid + ":" + READER_ID + ":" + libId + ":" + action + ":" + String(iat) + ":" + String(exp) + ":" + nonce;
   
   byte hmacResult[32];
   mbedtls_md_context_t ctx;
   mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;
   mbedtls_md_init(&ctx);
   mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 1);
   mbedtls_md_hmac_starts(&ctx, (const unsigned char*)deviceSecret, strlen(deviceSecret));
   mbedtls_md_hmac_update(&ctx, (const unsigned char*)payload.c_str(), payload.length());
   mbedtls_md_hmac_finish(&ctx, hmacResult);
   mbedtls_md_free(&ctx);
   
   String computedHex = "";
   for(int i=0; i<32; i++) {
     char buf[3];
     sprintf(buf, "%02x", hmacResult[i]);
     computedHex += buf;
   }
   
   if (!computedHex.equalsIgnoreCase(hmacHex)) {
     Serial.println("BLE Auth rejected: HMAC signature mismatch");
     return false;
   }
   
   // 7. Nonce Replay Check with Mutex & Expiration
   if (nonce.length() == 0 || nonce.length() > 11) return false;
   
   portENTER_CRITICAL(&nonceMutex);
   for (size_t i = 0; i < nonceCount; i++) {
     if (strcmp(recentNonces[i].nonce, nonce.c_str()) == 0) {
       portEXIT_CRITICAL(&nonceMutex);
       Serial.println("BLE Auth rejected: Nonce replay detected (" + nonce + ")");
       return false;
     }
   }
   
   if (nonceCount < BLE_NONCE_CACHE_SIZE) {
     strncpy(recentNonces[nonceCount].nonce, nonce.c_str(), 11);
     recentNonces[nonceCount].nonce[11] = '\0';
     recentNonces[nonceCount].exp = exp;
     nonceCount++;
   } else {
     size_t replaceIdx = 0;
     for (size_t i = 1; i < BLE_NONCE_CACHE_SIZE; i++) {
       if (recentNonces[i].exp < recentNonces[replaceIdx].exp) {
         replaceIdx = i;
       }
     }
     strncpy(recentNonces[replaceIdx].nonce, nonce.c_str(), 11);
     recentNonces[replaceIdx].nonce[11] = '\0';
     recentNonces[replaceIdx].exp = exp;
   }
   portEXIT_CRITICAL(&nonceMutex);
   
   saveNoncesToPreferences();
   if (nowUnix > highestTrustedTime) {
     highestTrustedTime = nowUnix;
     preferences.putUInt("highTime", highestTrustedTime);
   }
   
   return true;
}

void loadSnapshotFromFlash() {
  uint32_t trustedRev = preferences.getUInt("authRev", 0);
  activeSlot = preferences.getString("activeSlot", "A");
  String savedLib = preferences.getString("libId", "");
  if (savedLib != "") currentLibraryId = savedLib;
  
  uint32_t revA = 0, revB = 0;
  std::vector<AuthCredential> vecA, vecB;
  String libA, libB, devA, devB;
  
  bool okA = tryLoadSnapshot("/snapshot_A.txt", revA, vecA, libA, devA);
  bool okB = tryLoadSnapshot("/snapshot_B.txt", revB, vecB, libB, devB);
  
  if (okA && revA < trustedRev) okA = false;
  if (okB && revB < trustedRev) okB = false;
  
  if (okA && okB) {
    if (revA > revB) {
      activeSlot = "A";
      currentAuthRevision = revA;
      authSnapshot = vecA;
      currentLibraryId = libA;
      snapshotIsValid = true;
    } else if (revB > revA) {
      activeSlot = "B";
      currentAuthRevision = revB;
      authSnapshot = vecB;
      currentLibraryId = libB;
      snapshotIsValid = true;
    } else {
      if (activeSlot == "B") {
        currentAuthRevision = revB;
        authSnapshot = vecB;
        currentLibraryId = libB;
      } else {
        activeSlot = "A";
        currentAuthRevision = revA;
        authSnapshot = vecA;
        currentLibraryId = libA;
      }
      snapshotIsValid = true;
    }
  } else if (okA) {
    activeSlot = "A";
    currentAuthRevision = revA;
    authSnapshot = vecA;
    currentLibraryId = libA;
    snapshotIsValid = true;
  } else if (okB) {
    activeSlot = "B";
    currentAuthRevision = revB;
    authSnapshot = vecB;
    currentLibraryId = libB;
    snapshotIsValid = true;
  } else {
    currentAuthRevision = 0;
    authSnapshot.clear();
    snapshotIsValid = false;
  }
  Serial.println("Loaded snapshot, activeSlot: " + activeSlot + ", REV: " + String(currentAuthRevision) + ", valid: " + String(snapshotIsValid));
}

bool installCandidateSnapshot(const String &response, String &errorMsg) {
  if (response.length() > MAX_SNAPSHOT_SIZE) {
    errorMsg = "Payload too large: " + String(response.length());
    return false;
  }
  
  // Step 1: Pre-verify candidate in RAM. If invalid, DO NOT TOUCH FLASH!
  uint32_t candRev = 0;
  std::vector<AuthCredential> candVec;
  String candLib, candDev, candSec;
  if (!verifyAndParseSnapshot(response, candRev, candVec, candLib, candDev, candSec)) {
    errorMsg = "Candidate failed RAM verification. Flash write skipped.";
    return false;
  }
  
  // Step 2: Library scope check & Monotonic revision guard
  uint32_t trustedRev = preferences.getUInt("authRev", 0);
  if (currentLibraryId.length() > 0 && !candLib.equals(currentLibraryId)) {
    Serial.println("[SECURITY] Library reassignment detected (" + currentLibraryId + " -> " + candLib + "). Purging old library snapshot.");
    if (LittleFS.exists("/snapshot_A.txt")) LittleFS.remove("/snapshot_A.txt");
    if (LittleFS.exists("/snapshot_B.txt")) LittleFS.remove("/snapshot_B.txt");
    authSnapshot.clear();
    snapshotIsValid = false;
    currentAuthRevision = 0;
    trustedRev = 0;
    preferences.putUInt("authRev", 0);
  } else if (snapshotIsValid) {
    if (candRev <= currentAuthRevision) {
      errorMsg = "Candidate revision " + String(candRev) + " not strictly greater than active " + String(currentAuthRevision);
      return false;
    }
  } else {
    // Recovery mode: must not roll back below highest trusted revision from NVS
    if (candRev < trustedRev) {
      errorMsg = "Candidate revision " + String(candRev) + " is less than trusted NVS revision " + String(trustedRev) + " (rollback rejected)";
      return false;
    }
  }
  
  // Step 3: Write candidate to INACTIVE slot
  String targetFile = (activeSlot == "A") ? "/snapshot_B.txt" : "/snapshot_A.txt";
  File file = LittleFS.open(targetFile, "w");
  if (!file) {
    errorMsg = "Failed to open flash target file: " + targetFile;
    return false;
  }
  file.print(response);
  file.flush();
  file.close();
  
  // Step 4: Read back from flash and re-verify
  uint32_t diskRev = 0;
  std::vector<AuthCredential> diskVec;
  String diskLib, diskDev;
  if (!tryLoadSnapshot(targetFile, diskRev, diskVec, diskLib, diskDev) || diskRev != candRev) {
    errorMsg = "Candidate read-back verification failed. Removing corrupted candidate.";
    LittleFS.remove(targetFile);
    return false;
  }
  
  // Step 5: Atomic activation
  activeSlot = (activeSlot == "A") ? "B" : "A";
  currentAuthRevision = diskRev;
  authSnapshot = diskVec;
  currentLibraryId = diskLib;
  if (candSec.length() > 0) {
    strncpy(deviceSecret, candSec.c_str(), 64);
    deviceSecret[64] = '\0';
  }
  snapshotIsValid = true;
  
  preferences.putUInt("authRev", currentAuthRevision);
  preferences.putString("activeSlot", activeSlot);
  preferences.putString("libId", currentLibraryId);
  return true;
}
void syncSnapshot(bool force = false) {
  if (WiFi.status() != WL_CONNECTED) return;
  if (!force && (millis() - lastSyncAttemptMs < syncBackoffIntervalMs)) return;
  lastSyncAttemptMs = millis();
  
  WiFiClientSecure *client = new WiFiClientSecure;
  if (!client) return;
  
  client->setCACert(rootCACertificate);
  HTTPClient http;
  String url = String(BACKEND_BASE_URL) + "/api/hardware/sync?macAddress=" + String(READER_ID) + "&revision=" + String(currentAuthRevision);
  Serial.println("[SYNC] Starting snapshot sync for rev " + String(currentAuthRevision) + " -> URL: " + url);
  http.begin(*client, url);
  http.addHeader("Authorization", "Bearer " + String(HARDWARE_API_KEY));
  http.setTimeout(15000);
  
  esp_task_wdt_reset();
  int httpCode = http.GET();
  esp_task_wdt_reset();
  Serial.println("[SYNC] HTTP code: " + String(httpCode));
  if (httpCode == 200) {
    int contentLen = http.getSize();
    if (contentLen > MAX_SNAPSHOT_SIZE) {
      Serial.println("[SYNC] Snapshot too large: " + String(contentLen));
      syncBackoffIntervalMs = min(syncBackoffIntervalMs * 2, 300000UL);
      http.end();
      delete client;
      return;
    }
    
    String response = http.getString();
    http.end();
    delete client;
    
    if (response.length() > MAX_SNAPSHOT_SIZE) {
      Serial.println("[SYNC] Payload too large: " + String(response.length()));
      syncBackoffIntervalMs = min(syncBackoffIntervalMs * 2, 300000UL);
      return;
    }
    
    if (response.indexOf("UP_TO_DATE") != -1) {
      Serial.println("[SYNC] Server reports UP_TO_DATE.");
      syncBackoffIntervalMs = 60000UL;
      return;
    }
    
    String errorMsg;
    if (!installCandidateSnapshot(response, errorMsg)) {
      Serial.println("[SYNC ERROR] " + errorMsg);
      syncBackoffIntervalMs = min(syncBackoffIntervalMs * 2, 300000UL);
      return;
    }
    syncBackoffIntervalMs = 60000UL;
    Serial.println("[SYNC SUCCESS] Activated snapshot: slot " + activeSlot + ", rev " + String(currentAuthRevision) + ", items: " + String(authSnapshot.size()));
  } else {
    Serial.println("[SYNC FAILED] HTTP " + String(httpCode));
    syncBackoffIntervalMs = min(syncBackoffIntervalMs * 2, 300000UL);
    http.end();
    delete client;
  }
}

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;
  WiFiClientSecure *client = new WiFiClientSecure;
  if (client) {
    client->setCACert(rootCACertificate);
    HTTPClient http;
    http.begin(*client, String(BACKEND_BASE_URL) + "/api/hardware/heartbeat");
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + String(HARDWARE_API_KEY));
    http.setTimeout(8000);
    
    StaticJsonDocument<512> doc;
    doc["deviceId"] = READER_ID;
    doc["libraryId"] = currentLibraryId;
    doc["currentAuthRevision"] = currentAuthRevision;
    doc["snapshotIsValid"] = snapshotIsValid;
    doc["clockState"] = clockState;
    doc["freeBytes"] = LittleFS.totalBytes() - LittleFS.usedBytes();
    doc["pendingEvents"] = pendingEvents.size();
    
    String payload;
    serializeJson(doc, payload);
    
    bool needsSync = false;
    esp_task_wdt_reset();
    int code = http.POST(payload);
    esp_task_wdt_reset();
    isSystemOnline = (code == 200);
    if (code == 200) {
       String res = http.getString();
       StaticJsonDocument<256> resDoc;
       if (!deserializeJson(resDoc, res)) {
          if (resDoc.containsKey("serverTimeUnix")) {
             uint32_t sTime = resDoc["serverTimeUnix"];
             if (sTime > 1700000000 && clockState != CLOCK_SYNCED) {
                struct timeval tv = { (time_t)sTime, 0 };
                settimeofday(&tv, NULL);
                lastNtpSyncMs = millis();
                updateClockState();
                Serial.println("[TIME] Synced via Heartbeat serverTimeUnix: " + String(sTime) + " (clockState=" + String((int)clockState) + ")");
             }
          }
          uint32_t svrRev = resDoc["serverAuthRevision"];
          if (svrRev > currentAuthRevision) {
              Serial.println("Reconciliation required: SVR " + String(svrRev) + " > LOCAL " + String(currentAuthRevision));
              needsSync = true;
          } else if (svrRev < currentAuthRevision) {
              Serial.println("SVR REV LAGGING - NOT OVERWRITING");
          }
       }
    }
    http.end();
    delete client;

    // Perform snapshot sync AFTER heartbeat client is completely closed and freed
    if (needsSync) {
      syncSnapshot(true);
    }
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
#if !ENABLE_MQTT
  // Public unauthenticated broker (broker.hivemq.com:1883) is disabled in production to prevent
  // cleartext metadata leakage. Authoritative authorization revision reconciliation is performed
  // over TLS via HTTPS heartbeat (sendHeartbeat).
  return;
#else
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
#endif
}

void initJournal() {
  // CRITICAL RESILIENCE INVARIANT: formatOnFail MUST be false during normal boot.
  // LittleFS.begin(false) protects existing offline journal entries and active
  // snapshots from catastrophic erasure during transient mount failures or reboots.
  if (!LittleFS.begin(false)) {
    Serial.println("[LittleFS ERROR] Mount failed. Normal boot will NOT format automatically to protect journal data.");
    
    // Explicit technician provisioning action: requires NVS flag 'prov_format' or serial command within 3s
    bool explicitFormat = preferences.getBool("prov_format", false);
    if (!explicitFormat && Serial) {
      Serial.println("[PROVISIONING] Fresh board? Send 'FORMAT_PROVISION' via Serial within 3s to format partition...");
      unsigned long waitStart = millis();
      String cmd = "";
      while (millis() - waitStart < 3000) {
        if (Serial.available()) {
          cmd += (char)Serial.read();
          if (cmd.indexOf("FORMAT_PROVISION") != -1) {
            explicitFormat = true;
            break;
          }
        }
        delay(10);
      }
    }
    
    if (explicitFormat) {
      Serial.println("[PROVISIONING] Explicit format action confirmed. Formatting LittleFS...");
      preferences.remove("prov_format");
      if (LittleFS.format() && LittleFS.begin(false)) {
        Serial.println("[PROVISIONING] LittleFS formatted and mounted successfully.");
      } else {
        Serial.println("[PROVISIONING ERROR] LittleFS format failed.");
        return;
      }
    } else {
      Serial.println("[LittleFS BLOCKED] Preserving unmountable partition. Device entering fail-closed offline lock.");
      return;
    }
  }
  reloadJournal();
}

bool forceJournalFail = false;

bool appendToJournal(const ScanEvent& e) {
  if (forceJournalFail) return false;
  if (LittleFS.totalBytes() - LittleFS.usedBytes() < 10000) return false;
  File file = LittleFS.open("/journal.txt", "a");
  if (file) {
    String content = String(e.seqNo) + " " + e.eventId + " " + e.scanType + " " + e.payload + " " + String(e.timestampMs) + " " + String(e.isExit ? 1 : 0) + " " + String(e.timestampUnix) + " " + String(e.authRevision) + " " + String(e.offlineDecision ? 1 : 0);
    uint32_t crc_calc = 0;
    for(int i=0; i<content.length(); i++) crc_calc += content[i];
    
    file.print("ADD ");
    file.print(content);
    file.print(" ");
    size_t written = file.println(crc_calc);
    file.flush();
    file.close();
    return (written > 0);
  }
  return false;
}

void ackInJournal(String eventId) {
  File file = LittleFS.open("/journal.txt", "a");
  if (file) {
    file.println("ACK " + eventId);
    file.flush();
    file.close();
  }
}


// ================= CLOUD WORKER =================
void httpWorkerTask(void *pvParameters) {
  esp_task_wdt_add(NULL); // Register Core 0 httpWorkerTask with TWDT
  Serial.println("[WDT] httpWorkerTask registered to TWDT");

  static unsigned long lastHeartbeatMs = 0;
  static unsigned long lastWifiRetryMs = 0;
  static unsigned long wifiRetryIntervalMs = 15000; // Exponential backoff: 15s -> 30s -> 60s max

  while (true) {
    vTaskDelay(pdMS_TO_TICKS(20)); // Yield CPU to idle and IPC tasks

    // 1. Non-blocking Wi-Fi recovery supervisor
    if (WiFi.status() != WL_CONNECTED) {
      isSystemOnline = false;
      unsigned long now = millis();
      if (now - lastWifiRetryMs >= wifiRetryIntervalMs) {
        lastWifiRetryMs = now;
        Serial.printf("[WiFi Supervisor] Wi-Fi lost. Attempting non-blocking reconnect (backoff=%lums)...\n", wifiRetryIntervalMs);
        WiFi.disconnect();
        WiFi.reconnect();
        wifiRetryIntervalMs = min(wifiRetryIntervalMs * 2, 60000UL);
      }
      // While disconnected, do NOT attempt HTTP calls. Confirm task health and yield.
      esp_task_wdt_reset();
      vTaskDelay(pdMS_TO_TICKS(500));
      continue;
    } else {
      if (wifiRetryIntervalMs > 15000) {
        Serial.println("[WiFi Supervisor] Wi-Fi connection restored! Resetting backoff interval.");
        wifiRetryIntervalMs = 15000;
      }
    }

    if (millis() - lastHeartbeatMs >= 60000 || lastHeartbeatMs == 0) {
      lastHeartbeatMs = millis();
      esp_task_wdt_reset();
      sendHeartbeat();
      esp_task_wdt_reset();
      vTaskDelay(pdMS_TO_TICKS(100));
    }

    portENTER_CRITICAL(&queueMutex);
    bool isEmpty = pendingEvents.empty();
    bool needReload = isEmpty && hasMoreOnFlash;
    portEXIT_CRITICAL(&queueMutex);
    
    if (needReload) {
       reloadJournal();
       esp_task_wdt_reset();
       vTaskDelay(pdMS_TO_TICKS(50));
       continue;
    }
    
    if (isEmpty) {
      esp_task_wdt_reset();
      vTaskDelay(pdMS_TO_TICKS(100));
      continue;
    }
    
    ScanEvent currentEvent;
    bool hasEvent = false;
    
    portENTER_CRITICAL(&queueMutex);
    if (!pendingEvents.empty()) {
      currentEvent = pendingEvents.front();
      hasEvent = true;
    }
    portEXIT_CRITICAL(&queueMutex);
    
    if (!hasEvent) {
      esp_task_wdt_reset();
      vTaskDelay(pdMS_TO_TICKS(50));
      continue;
    }

    bool success = false;
    
    if (WiFi.status() == WL_CONNECTED) {
      WiFiClientSecure *client = new WiFiClientSecure;
      if (client) {
        client->setCACert(rootCACertificate);
        HTTPClient http;
        http.begin(*client, String(BACKEND_BASE_URL) + "/api/hardware/scan");
        http.addHeader("Content-Type", "application/json");

        // Hot-path optimization: static buffer avoids temporary Arduino String allocation
        char authHeader[128];
        snprintf(authHeader, sizeof(authHeader), "Bearer %s", HARDWARE_API_KEY);
        http.addHeader("Authorization", authHeader);
        http.setTimeout(12000);

        StaticJsonDocument<512> reqDoc;
        reqDoc["eventId"] = currentEvent.eventId;
        reqDoc["readerId"] = READER_ID.c_str();
        reqDoc["scanType"] = currentEvent.scanType;
        reqDoc["payload"] = currentEvent.payload;
        reqDoc["timestampUnix"] = currentEvent.timestampUnix;
        reqDoc["authRevision"] = currentEvent.authRevision;
        reqDoc["offlineDecision"] = currentEvent.offlineDecision ? "ALLOW" : "DENY";
        reqDoc["isExit"] = currentEvent.isExit;
        
        String requestBody;
        serializeJson(reqDoc, requestBody);
        
        Serial.printf("[HTTP] Syncing event %s (%s, payload=%s, exit=%d)...\n", currentEvent.eventId.c_str(), currentEvent.scanType.c_str(), currentEvent.payload.c_str(), currentEvent.isExit);
        esp_task_wdt_reset();
        int httpCode = http.POST(requestBody);
        esp_task_wdt_reset();
        Serial.printf("[HTTP] Scan POST code: %d\n", httpCode);
        
        if (httpCode >= 200 && httpCode < 300) {
          success = true;
          isSystemOnline = true;
        } else if (httpCode == 400) {
          File q = LittleFS.open("/quarantine.txt", "a");
          if (q) {
             q.println(currentEvent.eventId + " HTTP 400");
             q.close();
          }
          success = true;
          isSystemOnline = true;
        } else if (httpCode == 401 || httpCode == 403) {
          success = false;
          isSystemOnline = true;
          delay(10000);
        } else if (httpCode == 429) {
          success = false;
          isSystemOnline = true;
          delay(5000);
        } else {
          success = false;
          if (httpCode < 0) isSystemOnline = false;
        }
        http.end();
        delete client;
      }
    }
    
    if (success) {
      portENTER_CRITICAL(&queueMutex);
      if (!pendingEvents.empty() && pendingEvents.front().eventId == currentEvent.eventId) {
        pendingEvents.erase(pendingEvents.begin());
      }
      portEXIT_CRITICAL(&queueMutex);
      
      ackInJournal(currentEvent.eventId);
    } else {
      delay(3000); // Retry backoff
    }
    esp_task_wdt_reset();
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
        WiFiClientSecure client; client.setCACert(rootCACertificate); http.begin(client, url);
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
      std::string stdVal = pCharacteristic->getValue();
      String value = String(stdVal.c_str());
      value.trim();
      Serial.println("[BLE] Received GATT Write: " + value);
      
      if (value.startsWith("UNLOCK_IN") || value.startsWith("UNLOCK_OUT")) {
         bool isExitCmd = value.startsWith("UNLOCK_OUT");
         Serial.printf("[BLE] Direct unlock command: %s (Exit=%d)\n", value.c_str(), isExitCmd);
         BleAuthItem item;
         int colon = value.indexOf(':');
         if (colon > 0) {
           String uid = value.substring(colon + 1);
           uid.trim();
           strncpy(item.uid, uid.c_str(), 39);
           item.uid[39] = '\0';
         } else {
           strncpy(item.uid, "DIRECT_UNLOCK", 39);
           item.uid[39] = '\0';
         }
         item.isExit = isExitCmd;
         if (bleAuthQueue != NULL) {
             xQueueSend(bleAuthQueue, &item, 0);
         }
         return;
      }
      
      if (value.startsWith("BLE:")) {
         int p1 = value.indexOf(':', 4);
         if (p1 == -1) return;
         String uid = value.substring(4, p1);
         
         int p2 = value.indexOf(':', p1+1);
         if (p2 == -1) return;
         String libId = value.substring(p1+1, p2);
         
         int p3 = value.indexOf(':', p2+1);
         if (p3 == -1) return;
         String action = value.substring(p2+1, p3);
         
         int p4 = value.indexOf(':', p3+1);
         if (p4 == -1) return;
         uint32_t iat = value.substring(p3+1, p4).toInt();
         
         int p5 = value.indexOf(':', p4+1);
         if (p5 == -1) return;
         uint32_t exp = value.substring(p4+1, p5).toInt();
         
         int p6 = value.indexOf(':', p5+1);
         if (p6 == -1) return;
         String nonce = value.substring(p5+1, p6);
         String sig = value.substring(p6+1);
         
         if (verifyBLEToken(uid, libId, action, iat, exp, nonce, sig)) {
             BleAuthItem item;
             strncpy(item.uid, uid.c_str(), 39);
             item.uid[39] = '\0';
             item.isExit = (action.equalsIgnoreCase("OUT") || action.equalsIgnoreCase("CHECK_OUT"));
             if (bleAuthQueue != NULL) {
                 xQueueSend(bleAuthQueue, &item, 0);
             }
         }
      }
    }
};



void initBLE() {
  if (bleAuthQueue == NULL) {
    bleAuthQueue = xQueueCreate(10, sizeof(BleAuthItem));
  }
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
  
  NimBLEAdvertisementData oAdvertisementData = NimBLEAdvertisementData();
  oAdvertisementData.setFlags(0x06); // General discoverable and connectable
  oAdvertisementData.setName("FocusX");
  oAdvertisementData.setCompleteServices(NimBLEUUID(SERVICE_UUID));
  pAdvertising->setAdvertisementData(oAdvertisementData);

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
  
  NimBLEAdvertisementData oScanResponseData = NimBLEAdvertisementData();
  oScanResponseData.setManufacturerData(std::string((char*)payload, 25));
  pAdvertising->setScanResponseData(oScanResponseData);
  
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

void safeTone(unsigned int freq, unsigned long duration = 0) {
  #if defined(BUZZER_PIN) && BUZZER_PIN >= 0
  if (duration > 0) tone(BUZZER_PIN, freq, duration);
  else tone(BUZZER_PIN, freq);
  #endif
}

void safeNoTone() {
  #if defined(BUZZER_PIN) && BUZZER_PIN >= 0
  noTone(BUZZER_PIN);
  #endif
}

bool isDoorReedHigh() {
  #if defined(REED_PIN) && REED_PIN >= 0
  return reedSwitchEnabled ? (digitalRead(REED_PIN) == HIGH) : false;
  #else
  return false;
  #endif
}

void sendDFPlayerCommand(uint8_t cmd, uint16_t param) {
  uint8_t buf[10];
  buf[0] = 0x7E;
  buf[1] = 0xFF;
  buf[2] = 0x06;
  buf[3] = cmd;
  buf[4] = 0x00; // No ACK
  buf[5] = (uint8_t)(param >> 8);
  buf[6] = (uint8_t)(param & 0xFF);
  uint16_t checksum = 0 - (0xFF + 0x06 + cmd + 0x00 + buf[5] + buf[6]);
  buf[7] = (uint8_t)(checksum >> 8);
  buf[8] = (uint8_t)(checksum & 0xFF);
  buf[9] = 0xEF;
  Serial1.write(buf, 10);
  Serial1.flush();
}

void initVoiceSpeaker() {
  delay(1000); // Give MP3-TF-16P internal MCU time to boot up and mount SD
  // 1. DFPlayer: Select TF Card as playback device (0x09, 0x0002)
  sendDFPlayerCommand(0x09, 0x0002);
  delay(100);
  // 2. DFPlayer: Set Volume to 28 (0x06, 0x001C)
  sendDFPlayerCommand(0x06, 0x001C);
  delay(100);
}

void sendVoiceCommand(uint8_t trackNumber) {
  // Clear any garbage bytes in Serial1 RX buffer
  while (Serial1.available()) Serial1.read();
  
  // 1. Ensure TF Card is selected (0x09, 0x0002)
  sendDFPlayerCommand(0x09, 0x0002);
  delay(30);

  // 2. Set Volume to high (28/30) in case module brownout/reset (0x06, 0x001C)
  sendDFPlayerCommand(0x06, 0x001C);
  delay(30);

  // 3. Play track from root folder (Command 0x03)
  sendDFPlayerCommand(0x03, trackNumber);
  delay(40);

  // 4. Play track from /mp3/ folder (Command 0x12)
  sendDFPlayerCommand(0x12, trackNumber);
}

void triggerVoiceWelcome() { sendVoiceCommand(1); }
void triggerVoiceGoodbye() { sendVoiceCommand(2); }

void playWelcomeChime() { safeTone(1500, 150); delay(150); safeNoTone(); triggerVoiceWelcome(); }
void playGoodbyeChime() { safeTone(1500, 150); delay(150); safeNoTone(); triggerVoiceGoodbye(); }
void playDeniedChime() { safeTone(300, 500); delay(500); safeNoTone(); }

void updateIdleDisplay(bool force = false) {
  if (isGateOpen) return;
  
  bool curOnline = (WiFi.status() == WL_CONNECTED && isSystemOnline);
  bool timeSynced = (clockState == CLOCK_SYNCED);
  bool snapOk = (snapshotIsValid && !authSnapshot.empty());
  bool rfidOk = (nfc1Available || nfc2Available);
  
  String line0, line1;
  if (!rfidOk) {
    line0 = "RFID HW ERROR!  ";
    line1 = "CHECK WIRING    ";
  } else if (!snapOk) {
    line0 = "NO SNAPSHOT!    ";
    line1 = "SYNCING CLOUD...";
  } else if (!timeSynced) {
    line0 = "SYNCING CLOCK...";
    line1 = "PLEASE WAIT...  ";
  } else if (!curOnline) {
    line0 = "ARMED  (OFFLINE)";
    line1 = "TAP YOUR CARD   ";
  } else {
    line0 = "SYSTEM ARMED    ";
    line1 = "TAP YOUR CARD   ";
  }
  
  static String lastLine0 = "";
  static String lastLine1 = "";
  if (force || line0 != lastLine0 || line1 != lastLine1) {
    lastLine0 = line0;
    lastLine1 = line1;
    lcd.setCursor(0, 0);
    lcd.print(line0);
    lcd.setCursor(0, 1);
    lcd.print(line1);
  }
}

void resetToIdle() {
  isGateOpen = false;
  hasDoorOpenedDuringGrace = false;
  openedByRFID2 = false;
  setLEDsColor(0, 0, 255);
  setRFID2StripColor(0, 0, 255);
  lcd.clear();
  updateIdleDisplay(true);
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
    safeNoTone();
    delay(20);
  }
  setLEDsColor(0,0,0);
}

// ================= CHECK RFID =================
bool matchCredential(const char* credUid, const char* scannedPayload) {
  if (strcasecmp(credUid, scannedPayload) == 0) return true;
  const char* p1 = credUid;
  const char* p2 = scannedPayload;
  while (*p1 || *p2) {
    while (*p1 && (*p1 == ':' || *p1 == ' ' || *p1 == '-')) p1++;
    while (*p2 && (*p2 == ':' || *p2 == ' ' || *p2 == '-')) p2++;
    if (!*p1 && !*p2) return true;
    if (!*p1 || !*p2) return false;
    if (toupper((unsigned char)*p1) != toupper((unsigned char)*p2)) return false;
    p1++;
    p2++;
  }
  return true;
}

bool matchCredential(const String& credUid, const String& scannedPayload) {
  return matchCredential(credUid.c_str(), scannedPayload.c_str());
}

bool readRFID(Adafruit_PN532 &nfc, int ss_enable, int ss_disable, char* outHex, size_t maxLen) {
  digitalWrite(ss_disable, HIGH);
  digitalWrite(ss_enable, LOW);
  uint8_t uid[16];
  memset(uid, 0, 16);
  uint8_t uidLength = 0;
  bool success = nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 50);
  digitalWrite(ss_enable, HIGH);
  if (success && uidLength > 0) {
    if (uidLength > 16) uidLength = 16;
    if (maxLen > (size_t)(uidLength * 2)) {
      for (int i = 0; i < uidLength; i++) {
         sprintf(outHex + (i * 2), "%02X", uid[i]);
      }
      outHex[uidLength * 2] = '\0';
      
      int readerNum = (ss_enable == PN532_SS_1) ? 1 : 2;
      Serial.printf("[RFID] Reader %d detected card: Raw bytes (%d):", readerNum, uidLength);
      for (int i = 0; i < uidLength; i++) {
        Serial.printf(" 0x%02X", uid[i]);
      }
      Serial.printf(" -> Normalized UID: %s\n", outHex);
      return true;
    }
  }
  if (maxLen > 0) outHex[0] = '\0';
  return false;
}

String readRFID(Adafruit_PN532 &nfc, int ss_enable, int ss_disable) {
  char buf[33] = {0};
  if (readRFID(nfc, ss_enable, ss_disable, buf, sizeof(buf))) {
    return String(buf);
  }
  return "";
}

void executeDirectUnlock(bool isExit) {
  isGateOpen = true;
  gateOpenStartTime = millis();
  hasDoorOpenedDuringGrace = false;
  openedByRFID2 = isExit;
  
  if (isExit) {
    setLEDsColor(255, 80, 0);
    setRFID2StripColor(0, 255, 0);
    userIsInside = false;
    lcd.clear(); lcd.setCursor(0,0); lcd.print("BLE: GOODBYE!");
    lcd.setCursor(0,1); lcd.print("GATE OPEN");
    playGoodbyeChime();
  } else {
    setLEDsColor(0, 255, 0);
    userIsInside = true;
    lcd.clear(); lcd.setCursor(0,0); lcd.print("BLE: WELCOME!");
    lcd.setCursor(0,1); lcd.print("GATE OPEN");
    playWelcomeChime();
  }
  
  ScanEvent e;
  currentSeqNo++;
  e.seqNo = currentSeqNo;
  e.eventId = String(READER_ID) + "-" + String(bootCount) + "-" + String(currentSeqNo);
  e.scanType = "BLE";
  e.payload = "BLE_MANUAL";
  e.timestampMs = millis();
  e.timestampUnix = (uint32_t)time(NULL);
  e.isExit = isExit;
  e.authRevision = currentAuthRevision;
  e.offlineDecision = true;
  
  if (appendToJournal(e)) {
    portENTER_CRITICAL(&queueMutex);
    if (pendingEvents.size() < 500 && !hasMoreOnFlash) {
      pendingEvents.push_back(e);
    } else {
      hasMoreOnFlash = true;
    }
    portEXIT_CRITICAL(&queueMutex);
  }
}

void doAuth(String uid, String scanType, bool isExit) {
  updateClockState();
  bool isAllowed = false;
  bool cardFoundInSnapshot = false;
  String denialReason = "UNKNOWN";
  uint32_t nowUnix = (uint32_t)time(NULL);
  char matchedUserKey[40] = {0};
  
  if (READER_ID.length() == 0 || READER_ID == "UNPROVISIONED") {
    denialReason = "NOT_PROVISIONED";
  } else if (!snapshotIsValid) {
    denialReason = "SNAPSHOT_INVALID";
  } else {
    for (const auto& cred : authSnapshot) {
      if (matchCredential(cred.uid, uid.c_str()) || (cred.userKey[0] && matchCredential(cred.userKey, uid.c_str()))) {
        cardFoundInSnapshot = true;
        if (cred.userKey[0]) {
          strncpy(matchedUserKey, cred.userKey, 39);
          matchedUserKey[39] = '\0';
        }
        if (clockState == CLOCK_SYNCED) {
           if (nowUnix >= cred.validFrom && nowUnix <= cred.validUntil) {
             // Anti-Passback Check
             if (!isExit && cred.isInside) {
               isAllowed = false;
               denialReason = "ALREADY_INSIDE";
               break;
             } else if (isExit && !cred.isInside) {
               isAllowed = false;
               denialReason = "ALREADY_OUTSIDE";
               break;
             }
             isAllowed = true;
             denialReason = "ALLOWED";
             break;
           } else if (nowUnix < cred.validFrom) {
             denialReason = "NOT_YET_VALID";
           } else {
             denialReason = "EXPIRED";
           }
        } else {
           // Fail closed: do not silently convert clock uncertainty into authorization.
           denialReason = (clockState == CLOCK_STALE) ? "CLOCK_STALE" : "CLOCK_UNKNOWN";
           isAllowed = false;
        }
      }
    }
    if (!cardFoundInSnapshot && !isAllowed) {
      denialReason = "NOT_IN_SNAPSHOT";
    }
  }
  
  Serial.printf("[AUTH] Decision: %s | Reason: %s | ScanType: %s | Reader: %s | UID: %s | UserKey: %s | Slot: %s | Rev: %u | ClockState: %d | Time: %lu\n",
    isAllowed ? "ALLOWED" : "DENIED",
    denialReason.c_str(),
    scanType.c_str(),
    isExit ? "EXIT (Reader 2)" : "ENTRY (Reader 1)",
    uid.c_str(),
    matchedUserKey,
    activeSlot.c_str(),
    currentAuthRevision,
    (int)clockState,
    (unsigned long)nowUnix);

  if (isAllowed && (forceJournalFail || (LittleFS.totalBytes() - LittleFS.usedBytes() < 10000))) {
     isAllowed = false;
     Serial.println("[FAIL CLOSED] Storage full or forced fail.");
     lcd.clear(); lcd.setCursor(0,0); lcd.print("STORAGE FULL");
     lcd.setCursor(0,1); lcd.print("FAIL CLOSED");
     setLEDsColor(255, 0, 0);
     if (isExit) setRFID2StripColor(255, 0, 0);
     playDeniedChime();
     delay(2000);
     resetToIdle();
     return;
  }

  if (isAllowed) {
    // Near-zero latency instant actuation
    isGateOpen = true;
    gateOpenStartTime = millis();
    hasDoorOpenedDuringGrace = false;
    openedByRFID2 = isExit;
    if (isExit) {
      setLEDsColor(255, 80, 0);
      setRFID2StripColor(0, 255, 0);
      userIsInside = false;
      lcd.clear(); lcd.setCursor(0,0);
      if (scanType == "BLE") lcd.print("BLE: GOODBYE!");
      else lcd.print("GOODBYE!");
      lcd.setCursor(0,1); lcd.print("GATE OPEN");
      safeTone(1500, 150);
      triggerVoiceGoodbye();
    } else {
      setLEDsColor(0, 255, 0);
      userIsInside = true;
      lcd.clear(); lcd.setCursor(0,0);
      if (scanType == "BLE") lcd.print("BLE: WELCOME!");
      else lcd.print("WELCOME!");
      lcd.setCursor(0,1); lcd.print("GATE OPEN");
      safeTone(1500, 150);
      triggerVoiceWelcome();
    }

    // Synchronize anti-passback state across all credentials sharing this identity (RFID + User ID)
    for (auto& cred : authSnapshot) {
      if (matchCredential(cred.uid, uid.c_str()) || 
          (matchedUserKey[0] && strcmp(cred.userKey, matchedUserKey) == 0)) {
        cred.isInside = !isExit;
      }
    }

    if (highestTrustedTime > 0) {
       preferences.putUInt("highTime", highestTrustedTime);
    }

    // Journal event creation and append
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
    e.offlineDecision = true;

    if (appendToJournal(e)) {
      portENTER_CRITICAL(&queueMutex);
      if (pendingEvents.size() < 500 && !hasMoreOnFlash) {
        pendingEvents.push_back(e);
      } else {
        hasMoreOnFlash = true;
      }
      portEXIT_CRITICAL(&queueMutex);
    }
  } else {
    setLEDsColor(255, 0, 0);
    if (isExit) setRFID2StripColor(255, 0, 0);
    lcd.clear(); lcd.setCursor(0,0);
    if (denialReason == "NOT_PROVISIONED") lcd.print("UNPROVISIONED");
    else if (!snapshotIsValid) lcd.print("SYNC ERROR");
    else if (clockState != CLOCK_SYNCED) lcd.print("CLOCK UNKNOWN");
    else if (!cardFoundInSnapshot) lcd.print("UNKNOWN CARD");
    else if (denialReason == "EXPIRED") lcd.print("EXPIRED CARD");
    else if (denialReason == "ALREADY_INSIDE") lcd.print("ALREADY IN");
    else if (denialReason == "ALREADY_OUTSIDE") lcd.print("ALREADY OUT");
    else lcd.print("ACCESS DENIED");
    
    lcd.setCursor(0,1);
    if (scanType == "BLE") lcd.print("BLE DENIED");
    else lcd.print(isExit ? "EXIT DENIED" : "ENTRY DENIED");
    
    playDeniedChime();
    delay(1500);
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

  while (isDoorReedHigh() && (millis() - alarmStartTime < 5000)) {
    unsigned long currentTime = millis();
    if (currentTime - alarmStartTime <= ALARM_RFID_GRACE_MS && nfc1Available) {
      char r1Buf[33];
      if (readRFID(nfc1, PN532_SS_1, PN532_SS_2, r1Buf, sizeof(r1Buf))) {
        safeNoTone();
        doAuth(String(r1Buf), "rfid", false);
        return;
      }
    }
    safeTone(2000);
    if (currentTime - lastBlinkTime >= 150) {
      lastBlinkTime = currentTime;
      setAlarmLEDs(reversePattern);
      setRFID2AlarmLEDs(reversePattern);
      reversePattern = !reversePattern;
    }
    delay(10);
  }
  safeNoTone();
  resetToIdle();

  // Initialize Task Watchdog Timer (TWDT) for 30-second timeout
  esp_task_wdt_init(TWDT_TIMEOUT_S, true);
  esp_task_wdt_add(NULL); // Register Core 1 loopTask
  Serial.println("[WDT] Task Watchdog Timer initialized (30s timeout) and registered to Core 1 loopTask");
}

void triggerDoorLeftOpenAlarm() {
  lcd.clear(); lcd.setCursor(0,0); lcd.print("DOOR LEFT OPEN!");
  lcd.setCursor(0,1); lcd.print("PLEASE CLOSE");
  bool reversePattern = false;
  unsigned long lastBlinkTime = 0;
  unsigned long alarmStartTime = millis();

  while (isDoorReedHigh() && (millis() - alarmStartTime < 5000)) {
    unsigned long currentTime = millis();
    if (currentTime - lastBlinkTime >= 150) {
      lastBlinkTime = currentTime;
      setAlarmLEDs(reversePattern);
      setRFID2AlarmLEDs(reversePattern);
      reversePattern = !reversePattern;
    }
    safeTone(1800);
    delay(10);
  }
  safeNoTone();
  resetToIdle();
}

// ================= SETUP =================

void setup() {
  Serial.begin(115200);
  delay(1000);

  WiFi.mode(WIFI_STA);
  // Default to POC readerId, or override with preferences if set
  READER_ID = "87b99b2c-90fd-11e9-bc42-526af7764f64:1:1";

  preferences.begin("focusx", false);
  String savedReader = preferences.getString("readerid", "");
  if (savedReader != "") READER_ID = savedReader;
  String savedKey = preferences.getString("apikey", "");
  if (savedKey != "") strncpy(HARDWARE_API_KEY, savedKey.c_str(), sizeof(HARDWARE_API_KEY));
  reedSwitchEnabled = preferences.getBool("reed_en", false);

  bootCount = preferences.getUInt("bootCount", 0);
  loadNoncesFromPreferences();

  bootCount++;
  preferences.putUInt("bootCount", bootCount);
  initJournal();

  
    highestTrustedTime = preferences.getUInt("highTime", 0);
  
  // Set SNTP callback to track last sync
  sntp_set_time_sync_notification_cb([](struct timeval *t) {
     lastNtpSyncMs = millis();
     updateClockState();
     Serial.println("NTP Synced: " + String(time(NULL)));
  });

  loadSnapshotFromFlash();
  Serial.println("[BOOT] Stage 1: Snapshot loaded");
  // Restore anti-passback state from pending un-ACKed journal events
  for (const auto& ev : pendingEvents) {
    if (ev.offlineDecision) {
      char matchedKey[40] = {0};
      for (const auto& cred : authSnapshot) {
        if (matchCredential(cred.uid, ev.payload.c_str()) || (cred.userKey[0] && matchCredential(cred.userKey, ev.payload.c_str()))) {
          if (cred.userKey[0]) strncpy(matchedKey, cred.userKey, 39);
          break;
        }
      }
      for (auto& cred : authSnapshot) {
        if (matchCredential(cred.uid, ev.payload.c_str()) || (matchedKey[0] && strcmp(cred.userKey, matchedKey) == 0)) {
          cred.isInside = !ev.isExit;
        }
      }
    }
  }
  reconnectMqtt();

  Serial.println("[BOOT] Stage 2: Configuring GPIOs");
  Serial1.begin(VOICE_BAUD, SERIAL_8N1, -1, 43);
  initVoiceSpeaker();
  Serial.println("[HARDWARE] Voice Speaker Serial1 initialized on TX=" + String(VOICE_TX_PIN) + ", RX=" + String(VOICE_RX_PIN));
  if (BUZZER_PIN >= 0) pinMode(BUZZER_PIN, OUTPUT);
  if (REED_PIN >= 0) pinMode(REED_PIN, INPUT_PULLUP);
  pinMode(PN532_SS_1, OUTPUT);
  pinMode(PN532_SS_2, OUTPUT);
  digitalWrite(PN532_SS_1, HIGH);
  digitalWrite(PN532_SS_2, HIGH);

  Serial.println("[BOOT] Stage 3: Initializing NeoPixels");
  strip.begin(); strip.show(); strip.setBrightness(100);
  rfid2Strip.begin(); rfid2Strip.show(); rfid2Strip.setBrightness(100);

  Serial.println("[BOOT] Stage 4: Probing and initializing SafeLCD");

  Serial.println("[BOOT] Stage 5: Calling lcd.init()");
  lcd.init(); lcd.backlight(); lcd.clear();
  Serial.println("[BOOT] Stage 6: lcd.init() completed");

  lcd.setCursor(0,0); lcd.print("FOCUSX SCANNER");
  lcd.setCursor(0,1); lcd.print("STARTING UP...");
  delay(500);

  // Stage 6b: Probe & initialize PN532 RFID readers over SPI BEFORE network provisioning.
  // This guarantees offline attendance scanning is never delayed by router boot loops.
  Serial.println("[BOOT] Stage 6b: Initializing PN532 RFID readers over SPI");
  SPI.begin();
  nfc1.begin();
  uint32_t v1 = nfc1.getFirmwareVersion();
  if (!v1) {
    Serial.println("[HARDWARE] RFID 1 (PN532) NOT detected on SPI bus");
    nfc1Available = false;
  } else {
    Serial.println("[HARDWARE] RFID 1 (PN532) detected: 0x" + String(v1, HEX));
    nfc1.setPassiveActivationRetries(0x02); 
    nfc1.SAMConfig();
    nfc1Available = true;
  }

  nfc2.begin();
  uint32_t v2 = nfc2.getFirmwareVersion();
  if (!v2) {
    Serial.println("[HARDWARE] RFID 2 (PN532) NOT detected on SPI bus");
    nfc2Available = false;
  } else {
    Serial.println("[HARDWARE] RFID 2 (PN532) detected: 0x" + String(v2, HEX));
    nfc2.setPassiveActivationRetries(0x02); 
    nfc2.SAMConfig();
    nfc2Available = true;
  }

  Serial.println("[BOOT] Stage 7: Starting WiFiManager autoConnect");

  WiFiManager wm;
  wm.setConfigPortalTimeout(30); // 30s timeout so offline scanner boots promptly
  wm.setConnectTimeout(10);       // 10s timeout to connect to existing Wi-Fi

  lcd.clear();
  lcd.setCursor(0,0); lcd.print("WIFI CONNECTING");
  lcd.setCursor(0,1); lcd.print("AP:FocusX Scanner");
  Serial.println("[WiFi] Attempting autoConnect (SSID 'FocusX Scanner', portal timeout 180s)...");
  if (!wm.autoConnect("FocusX Scanner")) {
    Serial.println("[WiFi] Timed out or not configured. Proceeding in OFFLINE mode.");
    lcd.clear();
    lcd.setCursor(0,0); lcd.print("OFFLINE MODE");
    lcd.setCursor(0,1); lcd.print("SYSTEM READY");
    delay(1000);
  } else {
    Serial.println("[WiFi] Connected! IP: " + WiFi.localIP().toString());
    lcd.clear();
    lcd.setCursor(0,0); lcd.print("WIFI CONNECTED");
    lcd.setCursor(0,1); lcd.print(WiFi.localIP().toString());
    delay(1000);
  }

  // Dynamic Identity: preserved from preferences or default (no hardcoded overwrite)
  
  // PIN-based setup logic (executed only when online and device is unprovisioned)
  bool isClaimed = (READER_ID.length() > 0 && READER_ID != "UNPROVISIONED");
  if (WiFi.status() == WL_CONNECTED && !isClaimed) {
    lcd.clear(); lcd.setCursor(0,0); lcd.print("CHECKING CLAIM");
    
    // 1. Check if already claimed
    WiFiClientSecure *client = new WiFiClientSecure;
    if (client) {
      client->setCACert(rootCACertificate); 
      HTTPClient http;
      http.setTimeout(4000);
      if (http.begin(*client, "https://www.focusx.in/api/hardware/check-pin")) {
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
      delete client;
    }
    
    if (!isClaimed) {
      String pin = String(random(100000, 999999));
      {
        WiFiClientSecure client; 
        client.setCACert(rootCACertificate); 
        HTTPClient http;
        if (http.begin(client, "https://www.focusx.in/api/hardware/register-pin")) {
          http.addHeader("Content-Type", "application/json");
          http.POST("{\"pin\":\"" + pin + "\",\"mac\":\"" + String(READER_ID) + "\",\"readerId\":\"" + String(READER_ID) + "\"}");
          http.end();
        }
      }
      
      lcd.clear(); lcd.setCursor(0,0); lcd.print("CLAIM DEVICE PIN");
      lcd.setCursor(0,1); lcd.print(pin);
      
      while (!isClaimed) {
        delay(3000);
        {
          WiFiClientSecure client; 
          client.setCACert(rootCACertificate); 
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
      ESP.restart();
    }
  } else {
    Serial.println("[Claim] Device is offline. Skipped cloud claim registration.");
  }
  // Keep preferences open for runtime NVS updates
  // preferences.end();

  // NTP Time (when online)
  if (WiFi.status() == WL_CONNECTED) {
    configTime(0, 0, "pool.ntp.org", "time.google.com", "time.cloudflare.com");
    lcd.clear(); lcd.setCursor(0,0); lcd.print("SYNCING CLOUD");
  }
  
  // Start BLE
  initBLE();

  // Cloud Queues
  authRequestQueue = xQueueCreate(10, sizeof(AuthRequest));
  authResponseQueue = xQueueCreate(10, sizeof(AuthResponse));
  xTaskCreatePinnedToCore(httpWorkerTask, "HTTP", 32768, NULL, 1, NULL, 0);

  // (PN532 SPI readers were initialized at Stage 6b before Wi-Fi provisioning)

  // Pre-flight self-check sequence on LCD
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("SYSTEM SELF-TEST");
  String netStatus = (WiFi.status() == WL_CONNECTED) ? "WIFI:OK" : "WIFI:OFF";
  String clkStatus = (clockState == CLOCK_SYNCED) ? "CLK:OK" : "CLK:SYNC";
  lcd.setCursor(0, 1);
  lcd.print(netStatus + " " + clkStatus);
  delay(1200);

  lcd.clear();
  String rfidStatus = String("R1:") + (nfc1Available ? "OK" : "ERR") + " R2:" + (nfc2Available ? "OK" : "ERR");
  lcd.setCursor(0, 0);
  lcd.print(rfidStatus);
  String snapStatus = String("SNAP:V") + String(currentAuthRevision) + " (" + String(authSnapshot.size()) + "U)";
  lcd.setCursor(0, 1);
  lcd.print(snapStatus);
  delay(1200);

  resetToIdle();
}

// ================= SYSTEM HEALTH & DIAGNOSTICS =================
void printSystemStatus() {
  Serial.println("==================================================");
  Serial.println("              FOCUSX SYSTEM HEALTH CHECK          ");
  Serial.println("==================================================");
  Serial.println(" Device ID:       " + String(READER_ID));
  Serial.println(" Library ID:      " + String(currentLibraryId));
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" [1] Wi-Fi:       CONNECTED | IP: " + WiFi.localIP().toString() + " | RSSI: " + String(WiFi.RSSI()) + " dBm");
  } else {
    Serial.println(" [1] Wi-Fi:       DISCONNECTED (OFFLINE MODE)");
  }
  
  Serial.println(" [2] Cloud Link:  " + String(isSystemOnline ? "ONLINE (Heartbeat OK)" : "OFFLINE / UNREACHABLE"));
  
  String clkStr = "UNKNOWN (0)";
  if (clockState == CLOCK_SYNCED) clkStr = "SYNCED (1)";
  else if (clockState == CLOCK_STALE) clkStr = "DEGRADED (2)";
  Serial.println(" [3] Clock/NTP:   " + clkStr + " | Unix Time: " + String(time(NULL)));
  
  Serial.println(" [4] RFID 1 (In): " + String(nfc1Available ? "ONLINE (PN532 SPI)" : "FAULT / NOT DETECTED"));
  Serial.println(" [5] RFID 2 (Out):" + String(nfc2Available ? "ONLINE (PN532 SPI)" : "FAULT / NOT DETECTED"));
  
  Serial.println(" [6] Snapshot:    REV " + String(currentAuthRevision) + " | Slot: " + String(activeSlot) + 
                 " | Valid: " + String(snapshotIsValid ? "YES" : "NO") + 
                 " | Total Entries: " + String(authSnapshot.size()));
  
  Serial.println(" [7] BLE Service: ACTIVE & ADVERTISING");
  
  size_t totalBytes = LittleFS.totalBytes();
  size_t usedBytes = LittleFS.usedBytes();
  Serial.println(" [8] Storage:     " + String(totalBytes - usedBytes) + " bytes free / " + String(totalBytes) + " total");
  
  portENTER_CRITICAL(&queueMutex);
  size_t pendingCount = pendingEvents.size();
  portEXIT_CRITICAL(&queueMutex);
  Serial.println(" [9] Event Queue: " + String(pendingCount) + " pending events to sync");
  
  Serial.println(" [10] Free Heap:  " + String(ESP.getFreeHeap()) + " bytes");
  
  bool allOk = (snapshotIsValid && (nfc1Available || nfc2Available) && clockState == CLOCK_SYNCED);
  Serial.println("--------------------------------------------------");
  Serial.println(" OVERALL HEALTH:  " + String(allOk ? ">> 100% OPERATIONAL <<" : ">> ATTENTION REQUIRED <<"));
  Serial.println("==================================================");
}

// ================= LOOP =================
bool snapshotBuffering = false;
String snapshotBuffer = "";

void handleSerialCommands() {
  while (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() == 0) continue;

    if (snapshotBuffering) {
      if (line == "CMD:SNAPSHOT_END") {
        snapshotBuffering = false;
        String err;
        bool ok = installCandidateSnapshot(snapshotBuffer, err);
        if (ok) {
          Serial.println("OK:SNAPSHOT_ACTIVATED slot=" + activeSlot + " rev=" + String(currentAuthRevision));
        } else {
          Serial.println("ERR:SNAPSHOT_REJECTED " + err);
        }
        snapshotBuffer = "";
      } else {
        snapshotBuffer += line + "\n";
      }
      continue;
    }

    if (line == "CMD:SNAPSHOT_BEGIN") {
      snapshotBuffering = true;
      snapshotBuffer = "";
      Serial.println("OK:READY_FOR_SNAPSHOT");
    } else if (line == "CMD:STATUS") {
      updateClockState();
      String s = "STATUS: rev=" + String(currentAuthRevision) + " nvsRev=" + String(preferences.getUInt("authRev", 0)) +
                 " valid=" + String(snapshotIsValid ? 1 : 0) +
                 " slot=" + activeSlot +
                 " readerId=" + READER_ID +
                 " libId=" + currentLibraryId +
                 " freeFlash=" + String(LittleFS.totalBytes() - LittleFS.usedBytes()) +
                 " clockState=" + String((int)clockState) +
                 " nowUnix=" + String((uint32_t)time(NULL)) +
                 " trustedTime=" + String(highestTrustedTime) +
                 " gateOpen=" + String(isGateOpen ? 1 : 0) +
                 " nfc1=" + String(nfc1Available ? 1 : 0) +
                 " nfc2=" + String(nfc2Available ? 1 : 0);
      Serial.println(s);
    } else if (line.startsWith("CMD:SET_IDENTITY ")) {
      String newId = line.substring(17);
      newId.trim();
      if (newId.length() > 0) {
        READER_ID = newId;
        preferences.putString("readerid", newId);
        // Wipe old snapshots to prevent cross-library authorization
        currentAuthRevision = 0;
        currentLibraryId = "";
        snapshotIsValid = false;
        authSnapshot.clear();
        preferences.putUInt("authRev", 0);
        preferences.putString("libId", "");
        if (LittleFS.exists("/snapshot_A.txt")) LittleFS.remove("/snapshot_A.txt");
        if (LittleFS.exists("/snapshot_B.txt")) LittleFS.remove("/snapshot_B.txt");
        Serial.println("OK:IDENTITY_SET " + newId);
      } else {
        Serial.println("ERR:EMPTY_ID");
      }
    } else if (line.startsWith("CMD:JOURNAL_APPEND ")) {
      String rest = line.substring(19);
      int sp1 = rest.indexOf(' ');
      int sp2 = rest.indexOf(' ', sp1 + 1);
      if (sp1 > 0 && sp2 > 0) {
        String scanType = rest.substring(0, sp1);
        String uid = rest.substring(sp1 + 1, sp2);
        bool isExit = (rest.substring(sp2 + 1).toInt() == 1);
        
        ScanEvent e;
        currentSeqNo++;
        e.seqNo = currentSeqNo;
        e.eventId = String(READER_ID) + "-" + String(bootCount) + "-" + String(currentSeqNo);
        e.scanType = scanType;
        e.payload = uid;
        e.timestampMs = millis();
        e.timestampUnix = (uint32_t)time(NULL);
        e.isExit = isExit;
        e.authRevision = currentAuthRevision;
        e.offlineDecision = true;

        bool ok = appendToJournal(e);
        if (ok) {
          Serial.println("OK:APPENDED " + e.eventId);
        } else {
          Serial.println("ERR:JOURNAL_FAIL");
        }
      } else {
        Serial.println("ERR:BAD_ARGS");
      }
    } else if (line == "CMD:JOURNAL_DUMP") {
      Serial.println("===JOURNAL_START===");
      if (LittleFS.exists("/journal.txt")) {
        File f = LittleFS.open("/journal.txt", "r");
        if (f) {
          while (f.available()) {
            Serial.println(f.readStringUntil('\n'));
          }
          f.close();
        }
      }
      Serial.println("===JOURNAL_END===");
    } else if (line.startsWith("CMD:JOURNAL_FORCE_FAIL ")) {
      int val = line.substring(23).toInt();
      forceJournalFail = (val == 1);
      Serial.println("OK:FORCE_FAIL=" + String(forceJournalFail ? 1 : 0));
    } else if (line.startsWith("CMD:TIME_SET ")) {
      uint32_t t = (uint32_t)line.substring(13).toInt();
      struct timeval tv = { (time_t)t, 0 };
      settimeofday(&tv, NULL);
      lastNtpSyncMs = millis();
      updateClockState();
      Serial.println("OK:TIME_SET unix=" + String(t) + " clockState=" + String((int)clockState));
    } else if (line.startsWith("CMD:RFID_AUTH ")) {
      String rest = line.substring(14);
      int sp = rest.indexOf(' ');
      if (sp > 0) {
        int readerNum = rest.substring(0, sp).toInt();
        String uid = rest.substring(sp + 1);
        doAuth(uid, "rfid", readerNum == 2);
        Serial.println("OK:AUTH_DONE gateOpen=" + String(isGateOpen ? 1 : 0));
      } else {
        Serial.println("ERR:BAD_ARGS");
      }
    } else if (line.startsWith("CMD:BLE_VERIFY ")) {
      char buf[384];
      strncpy(buf, line.substring(15).c_str(), sizeof(buf) - 1);
      buf[sizeof(buf) - 1] = '\0';
      char *tokens[7];
      int tIdx = 0;
      char *p = strtok(buf, " ");
      while (p != NULL && tIdx < 7) {
        tokens[tIdx++] = p;
        p = strtok(NULL, " ");
      }
      if (tIdx == 7) {
        String uid = tokens[0];
        String libId = tokens[1];
        String action = tokens[2];
        uint32_t iat = (uint32_t)strtoul(tokens[3], NULL, 10);
        uint32_t exp = (uint32_t)strtoul(tokens[4], NULL, 10);
        String nonce = tokens[5];
        String hmacHex = tokens[6];
        bool ok = verifyBLEToken(uid, libId, action, iat, exp, nonce, hmacHex);
        if (ok) {
          doAuth(uid, "BLE", action.equalsIgnoreCase("OUT") || action.equalsIgnoreCase("CHECK_OUT"));
          Serial.println("OK:BLE_VERIFY res=1 gateOpen=" + String(isGateOpen ? 1 : 0));
        } else {
          Serial.println("OK:BLE_VERIFY res=0 gateOpen=" + String(isGateOpen ? 1 : 0));
        }
      } else {
        Serial.println("ERR:BAD_ARGS count=" + String(tIdx));
      }
    } else if (line == "CMD:VOICE 1" || line == "CMD:VOICE_IN") {
      triggerVoiceWelcome();
      Serial.println("OK:VOICE_1_WELCOME");
    } else if (line == "CMD:VOICE 2" || line == "CMD:VOICE_OUT") {
      triggerVoiceGoodbye();
      Serial.println("OK:VOICE_2_BYEBYE");
    } else if (line.startsWith("CMD:VOICE_VOL ")) {
      int v = line.substring(14).toInt();
      sendDFPlayerCommand(0x06, constrain(v, 0, 30));
      Serial.println("OK:VOICE_VOL=" + String(v));
    } else if (line == "CMD:STATUS" || line == "CMD:CHECK" || line == "CMD:DIAG") {
      printSystemStatus();
    } else if (line == "CMD:RESET_IDLE") {
      resetToIdle();
      Serial.println("OK:RESET_IDLE");
    } else if (line == "CMD:REBOOT") {
      Serial.println("OK:REBOOTING");
      Serial.flush();
      delay(200);
      ESP.restart();
    } else {
      Serial.println("ERR:UNKNOWN_CMD " + line);
    }
  }
}

void loop() {
  handleSerialCommands();
  unsigned long currentMillis = millis();
  bool doorState = isDoorReedHigh();

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

  static unsigned long lastIdleDisplayCheck = 0;
  if (!isGateOpen && (currentMillis - lastIdleDisplayCheck > 1000)) {
    lastIdleDisplayCheck = currentMillis;
    updateIdleDisplay(false);
  }

  if (shouldStartBLE) {
      shouldStartBLE = false;
      NimBLEDevice::getAdvertising()->start();
    }
  
    if (!isGateOpen && bleAuthQueue != NULL) {
      BleAuthItem item;
      if (xQueueReceive(bleAuthQueue, &item, 0) == pdTRUE) {
        if (strcmp(item.uid, "DIRECT_UNLOCK") == 0) {
          executeDirectUnlock(item.isExit);
        } else {
          doAuth(String(item.uid), "BLE", item.isExit);
        }
      }
    }

  if (!isGateOpen && doorState == LOW) {
    char rfidBuf[33];
    if (nfc1Available && readRFID(nfc1, PN532_SS_1, PN532_SS_2, rfidBuf, sizeof(rfidBuf))) {
      doAuth(String(rfidBuf), "rfid", false);
    }

    if (!isGateOpen && nfc2Available && readRFID(nfc2, PN532_SS_2, PN532_SS_1, rfidBuf, sizeof(rfidBuf))) {
      doAuth(String(rfidBuf), "rfid", true);
    }
  }

  esp_task_wdt_reset(); // Forward progress checkpoint for Core 1 loopTask
  delay(2);
}
