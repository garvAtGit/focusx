#include "WiFiConfigManager.h"
#include "config.h"
#include <ESP8266WiFi.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include <time.h>

// LittleFS JSON file replaces ESP32 NVS Preferences
static const char* WIFI_CONFIG_FILE = "/wifi_config.json";

WiFiConfigManager::WiFiConfigManager() : credentialsLoaded(false) {}

void WiFiConfigManager::init() {
    // Read stored credentials from LittleFS
    if (LittleFS.exists(WIFI_CONFIG_FILE)) {
        File file = LittleFS.open(WIFI_CONFIG_FILE, "r");
        if (file) {
            StaticJsonDocument<256> doc;
            DeserializationError error = deserializeJson(doc, file);
            file.close();
            
            if (!error) {
                storedSSID = doc["ssid"].as<String>();
                storedPassword = doc["pass"].as<String>();
                credentialsLoaded = (storedSSID.length() > 0);
            }
        }
    }
    
    if (credentialsLoaded) {
        Serial.println("[WiFiCfg] Found stored credentials for SSID: " + storedSSID);
    } else {
        Serial.println("[WiFiCfg] No stored WiFi credentials found.");
    }
}

bool WiFiConfigManager::hasStoredCredentials() {
    return credentialsLoaded && storedSSID.length() > 0;
}

String WiFiConfigManager::getStoredSSID() {
    return storedSSID;
}

String WiFiConfigManager::getStoredPassword() {
    return storedPassword;
}

bool WiFiConfigManager::applyNewCredentials(const String& ssid, const String& password) {
    Serial.println("[WiFiCfg] Applying new WiFi credentials...");
    Serial.println("[WiFiCfg] New SSID: " + ssid);
    
    // 1. Save to LittleFS (persists across reboots)
    File file = LittleFS.open(WIFI_CONFIG_FILE, "w");
    if (file) {
        StaticJsonDocument<256> doc;
        doc["ssid"] = ssid;
        doc["pass"] = password;
        serializeJson(doc, file);
        file.close();
        Serial.println("[WiFiCfg] Credentials saved to LittleFS.");
    } else {
        Serial.println("[WiFiCfg] Failed to write config file!");
    }
    
    // Update in-memory state
    storedSSID = ssid;
    storedPassword = password;
    credentialsLoaded = true;
    
    // 2. Disconnect from current WiFi
    Serial.println("[WiFiCfg] Disconnecting from current WiFi...");
    WiFi.disconnect(true);
    delay(500);
    
    // 3. Connect with new credentials
    Serial.println("[WiFiCfg] Connecting to new SSID: " + ssid);
    WiFi.begin(ssid.c_str(), password.c_str());
    
    // Wait up to 15 seconds for connection
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    Serial.println();
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("[WiFiCfg] Connected to new WiFi!");
        Serial.print("[WiFiCfg] IP Address: ");
        Serial.println(WiFi.localIP());
        
        // 4. Re-sync NTP
        syncNTP();
        return true;
    } else {
        Serial.println("[WiFiCfg] Failed to connect to new WiFi. Credentials saved for next boot.");
        Serial.println("[WiFiCfg] System will continue in OFFLINE mode.");
        return false;
    }
}

void WiFiConfigManager::syncNTP() {
    Serial.println("[WiFiCfg] Re-syncing NTP time...");
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
    
    for (int i = 0; i < 10; i++) {
        time_t now = time(nullptr);
        if (now > 1700000000) { // After ~Nov 2023 = NTP is synced
            Serial.println("[WiFiCfg] NTP re-sync success!");
            return;
        }
        Serial.println("[WiFiCfg] Waiting for NTP...");
        delay(1000);
    }
    Serial.println("[WiFiCfg] NTP re-sync failed. Clock may drift.");
}
