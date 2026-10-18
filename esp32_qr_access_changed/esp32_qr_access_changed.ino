#include <Arduino.h>
#include <LittleFS.h>
#include <map>
#include <WiFi.h>
#include <Preferences.h>
#include <SPI.h>
#include <MFRC522.h>
#include "config.h"
#include "SecurityManager.h"
#include "LogManager.h"
#include "HardwareController.h"

// Hardware Serial for GM67 Scanner
HardwareSerial ScannerSerial(2);

SecurityManager securityManager;
LogManager logManager;
HardwareController hwController;
Preferences preferences;
MFRC522 mfrc522(RFID_SS_PIN, RFID_RST_PIN);

String qrBuffer = "";
unsigned long lastCachePurge = 0;
std::map<String, bool> userInFacility; // true = IN, false = OUT

void saveState() {
    File file = LittleFS.open("/state.txt", "w");
    if (!file) {
        Serial.println("Failed to open state file for writing");
        return;
    }
    for (auto const& [uid, isIN] : userInFacility) {
        if (isIN) {
            file.println(uid);
        }
    }
    file.close();
}

void loadState() {
    File file = LittleFS.open("/state.txt", "r");
    if (!file) {
        Serial.println("No saved state found.");
        return;
    }
    while (file.available()) {
        String uid = file.readStringUntil('\n');
        uid.trim();
        if (uid.length() > 0) {
            userInFacility[uid] = true;
        }
    }
    file.close();
}

bool checkProvisionQR() {
    while (ScannerSerial.available()) {
        char c = ScannerSerial.read();
        if (c == '\n' || c == '\r') {
            if (qrBuffer.length() > 0) {
                Serial.print("Setup Scanned: ");
                Serial.println(qrBuffer);
                
                QRPayload result = securityManager.processQR(qrBuffer);
                qrBuffer = ""; // Reset buffer
                
                if (result.isValid && result.cmd == "PROVISION") {
                    Serial.println("PROVISION COMMAND RECEIVED DURING SETUP.");
                    
                    preferences.begin("library-app", false);
                    preferences.putString("ssid", result.ssid);
                    preferences.putString("password", result.pass);
                    preferences.putString("libId", result.libId);
                    preferences.end();
                    
                    Serial.println("Credentials saved to NVS. Restarting to connect...");
                    hwController.showMessage(" Saved WiFi!  ", "  Restarting... ", 3000);
                    delay(1500);
                    logManager.saveToFlash(); // Save any offline RAM logs before restart
                    ESP.restart(); // Restart to use new credentials instantly
                    return true;
                }
            }
        } else {
            qrBuffer += c;
        }
    }
    return false;
}

void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("\n--- ESP32 QR Access Control System ---");

    // Initialize Hardware
    hwController.init();
    hwController.showMessage("  Booting up... ", "", 0);
    delay(500);

    logManager.init();
    hwController.showMessage(" Log Sys: [\x01] ", "", 0);
    delay(500);

    securityManager.init();
    hwController.showMessage(" Security: [\x01] ", "", 0);
    delay(500);

    loadState(); // Load persisted user states
    hwController.showMessage(" States: [\x01] ", "", 0);
    delay(500);

    // Initialize SPI and RFID
    SPI.begin();
    mfrc522.PCD_Init();
    hwController.showMessage(" RFID: [\x01] ", "", 0);
    delay(500);

    // Initialize Scanner Serial
    ScannerSerial.begin(9600, SERIAL_8N1, QR_RX_PIN, QR_TX_PIN);
    hwController.showMessage(" Scanner: [\x01] ", "", 0);
    delay(500);

    // Read WiFi credentials from NVS
    preferences.begin("library-app", false);
    String ssid = preferences.getString("ssid", "");
    String password = preferences.getString("password", "");
    String libId = preferences.getString("libId", "");
    preferences.end();

    if (ssid == "") {
        Serial.println("No WiFi credentials found in NVS. Waiting for Provisioning QR...");
        hwController.showMessage(" Needs Config! ", " Scan Prov QR ", 0);
    } else {
        hwController.showWiFiConnecting();
        Serial.print("Connecting to WiFi: ");
        Serial.println(ssid);
        
        int retryCount = 0;
        while (WiFi.status() != WL_CONNECTED && retryCount < 3) {
            WiFi.begin(ssid.c_str(), password.c_str());
            int attempts = 0;
            // Wait up to 15 seconds, polling scanner for PROVISION codes
            while (WiFi.status() != WL_CONNECTED && attempts < 15) {
                unsigned long startWait = millis();
                while (millis() - startWait < 1000) {
                    checkProvisionQR();
                    delay(10); // Small delay to prevent watchdog starvation
                }
                Serial.print(".");
                attempts++;
            }
            if (WiFi.status() != WL_CONNECTED) {
                retryCount++;
                Serial.printf("\nWiFi failed. Retry %d/3\n", retryCount);
                if (retryCount < 3) {
                    hwController.showMessage(" WiFi Failed ", " Retry " + String(retryCount) + "/3 ", 0);
                    delay(2000);
                }
            }
        }
        
        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("\nFailed after 3 retries. Operating in OFFLINE mode.");
            hwController.showMessage(" WiFi Offline ", " Scanner Ready ", 2000);
            delay(2000);
            // DO NOT restart here, let it proceed to loop() so user can scan PROVISION QR!
            hwController.showMessage(" All Set Up! [\x01]", " Ready to Scan! ", 3000);
        } else {
            Serial.println("\nConnected to WiFi!");
            hwController.showMessage(" WiFi: [\x01] ", " IP Assigned ", 1000);
            Serial.print("IP Address: ");
            Serial.println(WiFi.localIP());
            delay(1000);
            
            // Sync NTP Time if connected
            Serial.println("Syncing NTP Time...");
            hwController.showMessage(" Syncing NTP... ", "", 0);
            
            int ntpRetries = 0;
            bool ntpSynced = false;
            while (!ntpSynced && ntpRetries < 3) {
                configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
                struct tm timeinfo;
                // getLocalTime has a built-in timeout, default is 5000ms
                if(!getLocalTime(&timeinfo)){
                    ntpRetries++;
                    Serial.printf("NTP Sync Failed. Retry %d/3\n", ntpRetries);
                    if (ntpRetries < 3) {
                        hwController.showMessage(" NTP Sync Failed", " Retry " + String(ntpRetries) + "/3 ", 2000);
                    } else {
                        hwController.showMessage(" NTP Failed!   ", " Offline Mode ", 2000);
                    }
                } else {
                    Serial.println(&timeinfo, "Time synced: %A, %B %d %Y %H:%M:%S");
                    hwController.showMessage(" NTP Sync: [\x01] ", "", 1000);
                    ntpSynced = true;
                }
            }
            delay(1000);
        }
        
        time_t finalTime;
        time(&finalTime);
        if (finalTime < 1000000000) {
            hwController.showMessage(" Clock Not Set! ", " Admin QR Only! ", 3000);
        } else {
            hwController.showMessage(" All Set Up! [\x01]", " Ready to Scan! ", 3000);
        }
    }
}

void loop() {
    // 1. Process Hardware Non-Blocking Delays (Door Unlock)
    hwController.process();

    // 2. Read from GM67 Scanner
    while (ScannerSerial.available()) {
        char c = ScannerSerial.read();
        if (c == '\n' || c == '\r') {
            if (qrBuffer.length() > 0) {
                // We have a full QR code payload
                Serial.print("Scanned: ");
                Serial.println(qrBuffer);
                
                QRPayload result = securityManager.processQR(qrBuffer);
                
                if (result.isValid) {
                    if (result.cmd == "PROVISION") {
                        Serial.println("PROVISION COMMAND RECEIVED.");
                        
                        preferences.begin("library-app", false);
                        preferences.putString("ssid", result.ssid);
                        preferences.putString("password", result.pass);
                        preferences.putString("libId", result.libId);
                        preferences.end();
                        
                        Serial.println("Credentials saved to NVS. Restarting...");
                        hwController.showMessage(" Saved WiFi!  ", "  Restarting... ", 3000);
                        delay(1500);
                        logManager.saveToFlash(); // Save any offline RAM logs before restart
                        ESP.restart();
                    } else if (result.cmd == "ADD_RFID") {
                        Serial.println("ADD_RFID COMMAND RECEIVED.");
                        securityManager.addRfidToNVS(result.rfid, result.exp);
                        hwController.showMessage("  RFID Added!   ", "ID: " + result.rfid, 3000);
                    } else if (result.cmd == "REVOKE_RFID") {
                        Serial.println("REVOKE_RFID COMMAND RECEIVED.");
                        securityManager.removeRfidFromNVS(result.rfid);
                        hwController.showMessage(" RFID Revoked!  ", "ID: " + result.rfid, 3000);
                    } else {
                        Serial.println("QR Valid -> Access Granted");
                        
                        bool isCurrentlyIn = userInFacility[result.uid];
                        time_t currentScanTime;
                        time(&currentScanTime);
                        
                        if (isCurrentlyIn) {
                            userInFacility[result.uid] = false; // Mark OUT
                            saveState();
                            Serial.println("Checking OUT -> Not unlocking door.");
                            hwController.showMessage(" Checked OUT!   ", " See you again! ", 3000);
                            logManager.addLog(result.uid, result.doorId, currentScanTime, "OUT", "");
                        } else {
                            userInFacility[result.uid] = true; // Mark IN
                            saveState();
                            Serial.println("Checking IN -> Unlocking door.");
                            hwController.showWelcome();
                            hwController.unlockDoor();
                            logManager.addLog(result.uid, result.doorId, currentScanTime, "IN", "");
                        }
                    }
                } else {
                    Serial.print("QR Invalid -> Access Denied. Reason: ");
                    Serial.println(result.failReason);
                    hwController.showError(result.failReason);
                    
                    if (result.uid != "UNKNOWN") {
                        time_t currentScanTime;
                        time(&currentScanTime);
                        // Log the failure to backend so dashboard can flag it
                        logManager.addLog(result.uid, result.doorId, currentScanTime, "DENIED", result.failReason);
                    }
                }
                
                qrBuffer = ""; // Reset buffer
            }
        } else {
            qrBuffer += c;
        }
    }

    // 3. Read from RFID
    if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
        String uidStr = "";
        for (byte i = 0; i < mfrc522.uid.size; i++) {
            uidStr += String(mfrc522.uid.uidByte[i] < 0x10 ? "0" : "");
            uidStr += String(mfrc522.uid.uidByte[i], HEX);
        }
        uidStr.toUpperCase();
        
        Serial.print("RFID Scanned: ");
        Serial.println(uidStr);
        
        int authResult = securityManager.checkRfidAuthorization(uidStr);
        
        time_t now;
        time(&now);

        if (authResult == 1) {
            Serial.println("RFID Valid -> Access Granted");
            
            bool isCurrentlyIn = userInFacility[uidStr];
            if (isCurrentlyIn) {
                userInFacility[uidStr] = false; // Mark OUT
                saveState();
                Serial.println("Checking OUT -> Not unlocking door.");
                hwController.showMessage(" Checked OUT!   ", " See you again! ", 3000);
                logManager.addLog(uidStr, String(DOOR_ID), now, "OUT", "RFID");
            } else {
                userInFacility[uidStr] = true; // Mark IN
                saveState();
                Serial.println("Checking IN -> Unlocking door.");
                hwController.showWelcome();
                hwController.unlockDoor();
                logManager.addLog(uidStr, String(DOOR_ID), now, "IN", "RFID");
            }
        } else if (authResult == -1) {
            Serial.println("RFID Expired -> Access Denied");
            hwController.showMessage("  Plan Expired  ", uidStr, 4000);
            logManager.addLog(uidStr, String(DOOR_ID), now, "DENIED", "Expired RFID");
        } else {
            Serial.println("RFID Unknown -> Access Denied");
            hwController.showMessage(" Access Denied! ", "Unknown: " + uidStr, 4000);
            logManager.addLog(uidStr, String(DOOR_ID), now, "DENIED", "Unknown RFID");
        }
        
        mfrc522.PICC_HaltA();
        mfrc522.PCD_StopCrypto1();
    }

    // 4. Periodic Background Tasks
    // Sync offline logs
    logManager.sync();
    
    // Purge Replay Cache every 10 seconds to save RAM
    if (millis() - lastCachePurge > 10000) {
        securityManager.purgeReplayCache();
        lastCachePurge = millis();
    }
}
