#ifndef CONFIG_H
#define CONFIG_H

// ==========================================
// PINS CONFIGURATION
// ==========================================
// Relay Pin
#define RELAY_PIN 4
// I2C Pins for LCD and PN532
#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 22

// PN532 SPI Pins
#define PN532_SS    5 

// ==========================================
// DOOR / LIBRARY CONFIGURATION
// ==========================================
const char* const LIBRARY_ID = "f6cd1770-e936-4457-b2ef-bf17bce9f730";
const char* const DOOR_ID = "MAIN_GATE_RFID";
const int DOOR_UNLOCK_TIME_MS = 3000;

// ==========================================
// NETWORK CONFIGURATION
// ==========================================
// NTP Server
const char* const NTP_SERVER = "pool.ntp.org";
const long  GMT_OFFSET_SEC = 19800; // GMT+5:30 (India)
const int   DAYLIGHT_OFFSET_SEC = 0;

// API Endpoints
const char* const API_LOG_ENDPOINT = "https://www.focusx.in/api/hardware/log";
// Endpoint to fetch authorized RFID tags as JSON array [{"uid":"...", "exp": 12345678}, ...]
const char* const API_SYNC_ENDPOINT = "https://www.focusx.in/api/hardware/rfids";
const char* const API_HARDWARE_KEY = "my_secret_library_door_key_123";

#endif // CONFIG_H
