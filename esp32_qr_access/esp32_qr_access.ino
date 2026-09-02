#include <Arduino.h>
#include <WiFi.h>
#include <Preferences.h>
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

String qrBuffer = "";
unsigned long lastCachePurge = 0;

void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("\n--- ESP32 QR Access Control System ---");

    // Initialize Hardware
    hwController.init();
    logManager.init();
    securityManager.init();

    // Initialize Scanner Serial
    ScannerSerial.begin(9600, SERIAL_8N1, QR_RX_PIN, QR_TX_PIN);

    // Read WiFi credentials from NVS
    preferences.begin("library-app", false);
    String ssid = preferences.getString("ssid", "");
    String password = preferences.getString("password", "");
    String libId = preferences.getString("libId", "");
    preferences.end();

    if (ssid == "") {
        Serial.println("No WiFi credentials found in NVS. Waiting for Provisioning QR...");
    } else {
        Serial.print("Connecting to WiFi: ");
        Serial.println(ssid);
        
        WiFi.begin(ssid.c_str(), password.c_str());
        
        // Wait up to 30 seconds for connection
        int attempts = 0;
        while (WiFi.status() != WL_CONNECTED && attempts < 30) {
            delay(1000);
            Serial.print(".");
            attempts++;
        }
        
        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("\nFailed to connect to WiFi. Operating in OFFLINE mode.");
        } else {
            Serial.println("\nConnected to WiFi!");
            Serial.print("IP Address: ");
            Serial.println(WiFi.localIP());
            
            // Sync NTP Time if connected
            Serial.println("Syncing NTP Time...");
            // Use multiple NTP servers: pool.ntp.org, time.nist.gov, and time.google.com for redundancy
            configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER, "time.nist.gov", "time.google.com");
            
            struct tm timeinfo;
            int ntpRetries = 0;
            while(!getLocalTime(&timeinfo, 5000) && ntpRetries < 5){
                Serial.println("Failed to obtain time, retrying NTP sync...");
                // Re-trigger configTime just in case the first DNS resolution failed completely
                if (ntpRetries == 2) {
                    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, "in.pool.ntp.org", "time.google.com", "time.windows.com");
                }
                delay(2000);
                ntpRetries++;
            }
            if(ntpRetries < 5){
                Serial.println(&timeinfo, "Time synced: %A, %B %d %Y %H:%M:%S");
            } else {
                Serial.println("CRITICAL: Failed to sync NTP time. QR Access will fail until synced.");
            }
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
                        delay(1000);
                        ESP.restart();
                    } else if (result.cmd == "ADD_RFID") {
                        Serial.println("ADD_RFID Command Received. Valid!");
                        preferences.begin("rfid_tags", false);
                        // value format: uid,exp
                        String val = result.uid + "," + String((unsigned long)result.exp);
                        preferences.putString(result.rfid.c_str(), val);
                        preferences.end();
                        Serial.println("RFID Assigned: " + result.rfid);
                    } else if (result.cmd == "REVOKE_RFID") {
                        Serial.println("REVOKE_RFID Command Received. Valid!");
                        preferences.begin("rfid_tags", false);
                        preferences.remove(result.rfid.c_str());
                        preferences.end();
                        Serial.println("RFID Revoked: " + result.rfid);
                    } else {
                        Serial.println("QR Valid -> Access Granted");
                        hwController.unlockDoor();
                        
                        // Add to log queue
                        logManager.addLog(result.uid, result.doorId, result.iat, "SUCCESS", "");
                    }
                } else {
                    Serial.print("QR Invalid -> Access Denied. Reason: ");
                    Serial.println(result.failReason);
                    
                    if (result.uid != "UNKNOWN") {
                        // Log the failure to backend so dashboard can flag it
                        logManager.addLog(result.uid, result.doorId, result.iat, "DENIED", result.failReason);
                    }
                }
                
                qrBuffer = ""; // Reset buffer
            }
        } else {
            qrBuffer += c;
        }
    }

    // 3. Periodic Background Tasks
    // Sync offline logs
    logManager.sync();
    
    // Purge Replay Cache every 10 seconds to save RAM
    if (millis() - lastCachePurge > 10000) {
        securityManager.purgeReplayCache();
        lastCachePurge = millis();
    }
}
