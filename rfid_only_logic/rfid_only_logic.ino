#include <Arduino.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <Wire.h>
#include <Adafruit_PN532.h>
#include <map>
#include "config.h"
#include "SecurityManager.h"
#include "LogManager.h"
#include "HardwareController.h"

#include <SPI.h>

// Instantiate PN532 over Hardware SPI
Adafruit_PN532 nfc(PN532_SS);

SecurityManager securityManager;
LogManager logManager;
HardwareController hwController;

std::map<String, bool> userInFacility; 
unsigned long lastSyncTime = 0;

void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("\n--- ESP32 PN532 RFID Access Control ---");

    hwController.init();
    hwController.showMessage("  Booting up... ", "", 0);
    
    logManager.init();
    securityManager.init();
    
    // Initialize PN532 via SPI
    nfc.begin();
    
    uint32_t versiondata = nfc.getFirmwareVersion();
    if (!versiondata) {
        Serial.println("Didn't find PN53x board. Check wiring.");
        hwController.showMessage(" PN532 Error! ", " Check Wiring ", 0);
        while (1) delay(10); // halt
    }
    Serial.printf("Found chip PN5%x\n", (versiondata>>24) & 0xFF);
    nfc.SAMConfig(); // configure board to read RFID tags
    
    // WiFiManager Setup (Captive Portal)
    WiFiManager wm;
    hwController.showMessage(" Connect to WiFi", " AP: LibrarySetup", 0);
    
    // wm.resetSettings(); // Un-comment to wipe WiFi settings for testing
    
    bool res = wm.autoConnect("LibrarySetup-RFID");
    if(!res) {
        Serial.println("Failed to connect to WiFi");
        hwController.showMessage(" WiFi Failed ", " Restarting... ", 2000);
        ESP.restart();
    } 
    
    Serial.println("Connected to WiFi!");
    hwController.showMessage(" WiFi Connected ", WiFi.localIP().toString(), 2000);
    
    // Sync Time
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
    hwController.showMessage(" Syncing NTP... ", "", 1000);
    
    // Initial RFID Sync
    hwController.showMessage(" Syncing RFIDs... ", "", 1000);
    securityManager.syncAuthorizedRFIDs();
    
    hwController.showMessage(" All Set Up! [\x01]", " Ready to Scan! ", 3000);
}

void loop() {
    // Process door lock/unlock timeouts
    hwController.process();
    
    uint8_t success;
    uint8_t uid[] = { 0, 0, 0, 0, 0, 0, 0 };  // Buffer to store the returned UID
    uint8_t uidLength;                        // Length of the UID (4 or 7 bytes depending on ISO14443A card type)
    
    // Wait for an ISO14443A type cards (Mifare, etc.). Timeout 50ms so it's non-blocking.
    success = nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 50);
    
    if (success) {
        String uidStr = "";
        for (uint8_t i=0; i < uidLength; i++) {
            uidStr += String(uid[i] < 0x10 ? "0" : "");
            uidStr += String(uid[i], HEX);
        }
        uidStr.toUpperCase();
        
        Serial.println("Scanned RFID: " + uidStr);
        
        int authResult = securityManager.checkRfidAuthorization(uidStr);
        time_t now;
        time(&now);
        
        if (authResult == 1) {
            bool isCurrentlyIn = userInFacility[uidStr];
            if (isCurrentlyIn) {
                userInFacility[uidStr] = false;
                Serial.println("Checking OUT");
                hwController.showMessage(" Checked OUT!   ", " See you again! ", 3000);
                logManager.addLog(uidStr, String(DOOR_ID), now, "OUT", "RFID");
            } else {
                userInFacility[uidStr] = true;
                Serial.println("Checking IN -> Unlocking");
                hwController.showWelcome();
                hwController.unlockDoor();
                logManager.addLog(uidStr, String(DOOR_ID), now, "IN", "RFID");
            }
        } else if (authResult == -1) {
            Serial.println("Expired RFID");
            hwController.showMessage("  Plan Expired  ", uidStr, 4000);
            logManager.addLog(uidStr, String(DOOR_ID), now, "DENIED", "Expired RFID");
        } else {
            Serial.println("Unknown RFID");
            hwController.showMessage(" Access Denied! ", "Unknown: " + uidStr, 4000);
            logManager.addLog(uidStr, String(DOOR_ID), now, "DENIED", "Unknown RFID");
        }
        
        // Anti-bounce delay so it doesn't scan 10 times a second
        delay(1500); 
    }
    
    // Background Tasks
    logManager.sync(); // Sync offline logs
    
    // Sync valid RFIDs from server every 5 minutes (300,000 ms)
    if (millis() - lastSyncTime > 300000) {
        securityManager.syncAuthorizedRFIDs();
        lastSyncTime = millis();
    }
}
