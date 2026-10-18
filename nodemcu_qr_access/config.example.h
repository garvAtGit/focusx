#ifndef CONFIG_H
#define CONFIG_H

// ==========================================
// PINS CONFIGURATION (NodeMCU / ESP8266)
// ==========================================
// Relay Pin
#define RELAY_PIN 15        // D8

// I2C LCD Pins
#define I2C_SDA_PIN 4       // D2
#define I2C_SCL_PIN 5       // D1
#define LCD_I2C_ADDR 0x27

// GM67 Scanner (SoftwareSerial for debug-friendly setup)
#define SCANNER_RX_PIN 12   // D6  ← Scanner TX wire goes here
#define SCANNER_TX_PIN 14   // D5  → Scanner RX wire goes here

// ==========================================
// DOOR / LIBRARY CONFIGURATION
// ==========================================
//  Set these for each specific physical installation
constexpr const char* LIBRARY_ID = "f6cd1770-e936-4457-b2ef-bf17bce9f730";
constexpr const char* DOOR_ID = "MAIN_GATE";
constexpr const int DOOR_UNLOCK_TIME_MS = 3000;

// ==========================================
// SECURITY CONFIGURATION
// ==========================================
// How long a QR code is valid from its 'iat' timestamp
constexpr const int QR_VALIDITY_SECONDS = 30;
// How long a WiFi config QR is valid (3 minutes for admin convenience)
constexpr const int WIFI_QR_VALIDITY_SECONDS = 180;

// ECDSA P-256 Public Key (Embed the generated key here)
constexpr const char* ECDSA_PUBLIC_KEY = 

"-----BEGIN PUBLIC KEY-----\n"
"MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEW/PFKOgkA5hCa8UX9Hvvd2zhwBZw\n"
"dEUzSEUpsDMlhztFicJt02ZPe/nH5wiRFhG3bKlwEFk9ejlEJ9By7/w5YQ==\n"
"-----END PUBLIC KEY-----\n";

// ==========================================
// NETWORK CONFIGURATION
// ==========================================
// NTP Server
constexpr const char* NTP_SERVER = "pool.ntp.org";
constexpr const long  GMT_OFFSET_SEC = 19800; // GMT+5:30 (India)
constexpr const int   DAYLIGHT_OFFSET_SEC = 0;

// API Endpoints
constexpr const char* API_LOG_ENDPOINT = "https://www.focusx.in/api/hardware/log";
// Note: Put the hardware API key here. Ensure it matches the RELAY_API_KEY in the backend.
constexpr const char* API_HARDWARE_KEY = "my_secret_library_door_key_123";

// ==========================================
// WIFI MANAGER CONFIGURATION
// ==========================================
constexpr const char* AP_NAME = "FocusDesk_Door_AP";
constexpr const int   PORTAL_TIMEOUT_SEC = 180;

#endif // CONFIG_H
