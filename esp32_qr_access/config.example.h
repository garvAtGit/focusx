#ifndef CONFIG_H
#define CONFIG_H

// ==========================================
// PINS CONFIGURATION
// ==========================================
// GM67 UART Pins
#define QR_RX_PIN 16
#define QR_TX_PIN 17
// Relay Pin
#define RELAY_PIN 4

// ==========================================
// DOOR / LIBRARY CONFIGURATION
// ==========================================
// Set these for each specific physical installation
const char* const LIBRARY_ID = "f6cd1770-e936-4457-b2ef-bf17bce9f730";
const char* const DOOR_ID = "MAIN_GATE";
const int DOOR_UNLOCK_TIME_MS = 3000;

// ==========================================
// SECURITY CONFIGURATION
// ==========================================
// How long a QR code is valid from its 'iat' timestamp
const int QR_VALIDITY_SECONDS = 30;

// ECDSA P-256 Public Key (Embed the generated key here)
const char* const ECDSA_PUBLIC_KEY = 
"-----BEGIN PUBLIC KEY-----\n"
"MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEW/PFKOgkA5hCa8UX9Hvvd2zhwBZw\n"
"dEUzSEUpsDMlhztFicJt02ZPe/nH5wiRFhG3bKlwEFk9ejlEJ9By7/w5YQ==\n"
"-----END PUBLIC KEY-----\n";

// ==========================================
// NETWORK CONFIGURATION
// ==========================================
// NTP Server
const char* const NTP_SERVER = "pool.ntp.org";
const long  GMT_OFFSET_SEC = 19800; // GMT+5:30 (India)
const int   DAYLIGHT_OFFSET_SEC = 0;

// API Endpoints
const char* const API_LOG_ENDPOINT = "https://www.focusx.in/api/hardware/log";
// Note: Put the hardware API key here. Ensure it matches the RELAY_API_KEY in the backend.
const char* const API_HARDWARE_KEY = "my_secret_library_door_key_123";

#endif // CONFIG_H
