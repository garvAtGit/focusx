#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <WiFiManager.h>
#include <SoftwareSerial.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <time.h>
#include "config.h"
#include "SecurityManager.h"
#include "LogManager.h"
#include "HardwareController.h"
#include "WiFiConfigManager.h"

// =====================================================
// DEBUG VERSION: SoftwareSerial for scanner,
// Hardware Serial (USB) for debug monitor at 115200
// =====================================================
// Wiring:
//   Scanner TX  →  GPIO12 (D6)
//   Scanner RX  →  GPIO14 (D5)
//   USB Serial Monitor → 115200 baud
// =====================================================

SoftwareSerial scannerSerial(SCANNER_RX_PIN, SCANNER_TX_PIN);

// I2C LCD (16x2)
LiquidCrystal_I2C lcd(LCD_I2C_ADDR, 16, 2);

// Module instances
SecurityManager securityManager;
LogManager logManager;
HardwareController hwController;
WiFiConfigManager wifiCfgManager;

// QR buffer for character-by-character reading
String qrBuffer = "";
unsigned long lastCachePurge = 0;

// =====================================================
// LCD Helper
// =====================================================
void showMessage(String line1, String line2 = "") {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(line1);
    lcd.setCursor(0, 1);
    lcd.print(line2);
}

// =====================================================
// NTP Sync (ESP8266-compatible)
// =====================================================
void syncNTPOnBoot() {
    Serial.println("[NTP] Syncing NTP Time...");
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);

    for (int i = 0; i < 15; i++) {
        time_t now = time(nullptr);
        if (now > 1700000000) { // After ~Nov 2023 means NTP is synced
            Serial.println("[NTP] Sync Success!");
            struct tm* timeinfo = localtime(&now);
            Serial.printf("[NTP] Time: %04d-%02d-%02d %02d:%02d:%02d\n",
                timeinfo->tm_year + 1900, timeinfo->tm_mon + 1, timeinfo->tm_mday,
                timeinfo->tm_hour, timeinfo->tm_min, timeinfo->tm_sec);
            return;
        }
        Serial.println("[NTP] Waiting...");
        delay(1000);
    }

    Serial.println("[NTP] Sync Failed!");
}

// =====================================================
// SETUP
// =====================================================
void setup() {
    // Hardware Serial for debug (USB Serial Monitor)
    Serial.begin(115200);
    delay(1000);
    Serial.println();
    Serial.println("========================================");
    Serial.println("  NodeMCU QR Access Control [DEBUG]");
    Serial.println("========================================");
    Serial.println("[INIT] Scanner on SoftwareSerial (D6 RX, D5 TX) @ 9600");
    Serial.println("[INIT] Debug on USB Serial @ 115200");
    Serial.println();

    // SoftwareSerial for GM67 scanner
    scannerSerial.begin(9600);

    // Initialize I2C and LCD
    Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
    lcd.init();
    lcd.backlight();
    showMessage("System", "    Starting...");
    Serial.println("[INIT] LCD initialized");

    // Initialize modules
    hwController.init();
    Serial.println("[INIT] Hardware controller ready (Relay on D8)");

    logManager.init();
    Serial.println("[INIT] Log manager ready (LittleFS)");

    securityManager.init();
    Serial.println("[INIT] Security manager ready (BearSSL ECDSA)");

    wifiCfgManager.init();

    // --- WiFi Connection Strategy ---
    bool connected = false;

    if (wifiCfgManager.hasStoredCredentials()) {
        Serial.println("[WIFI] Found stored credentials. Trying direct connect...");
        Serial.println("[WIFI] SSID: " + wifiCfgManager.getStoredSSID());
        showMessage("Connecting WiFi", wifiCfgManager.getStoredSSID());

        WiFi.begin(wifiCfgManager.getStoredSSID().c_str(), wifiCfgManager.getStoredPassword().c_str());

        int attempts = 0;
        while (WiFi.status() != WL_CONNECTED && attempts < 20) {
            delay(500);
            Serial.print(".");
            attempts++;
        }
        Serial.println();

        if (WiFi.status() == WL_CONNECTED) {
            connected = true;
            Serial.println("[WIFI] Connected via stored credentials!");
        } else {
            Serial.println("[WIFI] Stored credentials failed. Falling back to WiFiManager...");
            WiFi.disconnect(true);
            delay(500);
        }
    }

    // Fallback: WiFiManager captive portal
    if (!connected) {
        showMessage("WiFi Setup", " Connect to AP");
        Serial.println("[WIFI] Starting captive portal: " + String(AP_NAME));
        WiFiManager wm;
        wm.setConfigPortalTimeout(PORTAL_TIMEOUT_SEC);
        connected = wm.autoConnect(AP_NAME);
    }

    if (!connected) {
        Serial.println("[WIFI] FAILED — Operating in OFFLINE mode");
        showMessage("OFFLINE Mode", "No WiFi");
        delay(2000);
    } else {
        Serial.println("[WIFI] Connected!");
        Serial.print("[WIFI] IP Address: ");
        Serial.println(WiFi.localIP());
        showMessage("WiFi Connected!", WiFi.localIP().toString());
        delay(1000);

        showMessage("Syncing Time", "  Please wait...");
        syncNTPOnBoot();
        delay(500);
    }

    Serial.println();
    Serial.println("========================================");
    Serial.println("  READY — Waiting for QR scans...");
    Serial.println("========================================");
    Serial.println();
    showMessage("Scan To", "        Unlock");
}

// =====================================================
// MAIN LOOP
// =====================================================
void loop() {
    // 1. Process non-blocking door unlock timer
    hwController.process();

    if (hwController.checkJustLocked()) {
        Serial.println("[DOOR] Door locked — returning to idle");
        showMessage("Scan To", "        Unlock");
    }

    // 2. Read from GM67 Scanner via SoftwareSerial
    while (scannerSerial.available()) {
        char c = scannerSerial.read();
        if (c == '\n' || c == '\r') {
            // Strip non-printable leading characters
            while (qrBuffer.length() > 0 && (qrBuffer[0] < 0x20 || qrBuffer[0] > 0x7E)) {
                qrBuffer.remove(0, 1);
            }
            if (qrBuffer.length() > 10) {
                Serial.println("[SCAN] ────────────────────────────────");
                Serial.println("[SCAN] QR Data: " + qrBuffer);
                Serial.println("[SCAN] Length: " + String(qrBuffer.length()));

                showMessage("QR Scanned", "  Please wait...");

                // Detect QR type
                String qrType = securityManager.detectQRType(qrBuffer);
                Serial.println("[SCAN] QR Type: " + qrType);

                if (qrType == "wifi") {
                    // --- WiFi Configuration QR ---
                    Serial.println("[ADMIN] WiFi config QR detected!");
                    showMessage("WiFi Config", "  Processing...");

                    WiFiConfigPayload wifiResult = securityManager.processWiFiQR(qrBuffer);

                    if (wifiResult.isValid) {
                        Serial.println("[ADMIN] WiFi QR VALID");
                        Serial.println("[ADMIN] New SSID: " + wifiResult.ssid);
                        showMessage("WiFi Config", "  Applying...");

                        bool success = wifiCfgManager.applyNewCredentials(wifiResult.ssid, wifiResult.pass);
                        if (success) {
                            Serial.println("[ADMIN] WiFi changed successfully!");
                            showMessage("WiFi Changed!", "  Success");
                        } else {
                            Serial.println("[ADMIN] WiFi change failed — saved for next boot");
                            showMessage("WiFi Saved", " Next reboot");
                        }
                        delay(2000);
                    } else {
                        Serial.println("[ADMIN] WiFi QR INVALID — rejected");
                        showMessage("WiFi QR", "  Invalid!");
                        delay(2000);
                    }
                    showMessage("Scan To", "        Unlock");
                } else {
                    // --- Access QR ---
                    QRPayload result = securityManager.processQR(qrBuffer);

                    if (result.isValid) {
                        Serial.println("[ACCESS] ✓ GRANTED");
                        Serial.println("[ACCESS] UID: " + result.uid);
                        Serial.println("[ACCESS] Door: " + result.doorId);
                        Serial.printf("[ACCESS] IAT: %ld\n", result.iat);
                        showMessage("Access Granted", "    Welcome");
                        hwController.unlockDoor();
                        logManager.addLog(result.uid, result.doorId, result.iat);
                    } else {
                        Serial.println("[ACCESS] ✗ DENIED");
                        showMessage("Access Denied", "Please try again");
                        delay(2000);
                        showMessage("Scan To", "        Unlock");
                    }
                }

                Serial.println("[SCAN] ────────────────────────────────");
                Serial.println();
                qrBuffer = "";
            }
        } else if (c >= 0x20 && c <= 0x7E) {
            qrBuffer += c;
        }
    }

    // 3. Periodic Background Tasks
    logManager.sync();

    if (millis() - lastCachePurge > 10000) {
        securityManager.purgeReplayCache();
        lastCachePurge = millis();
    }
}
