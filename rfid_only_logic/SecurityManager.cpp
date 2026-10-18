#include "SecurityManager.h"
#include "config.h"
#include <Preferences.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

SecurityManager::SecurityManager() {}

void SecurityManager::init() {
    // Initialization if required
}

int SecurityManager::checkRfidAuthorization(const String& uid) {
    Preferences prefs;
    prefs.begin("rfid-auth", true);
    if (!prefs.isKey(uid.c_str())) {
        prefs.end();
        return 0; // Not found
    }
    time_t exp = prefs.getUInt(uid.c_str(), 0);
    prefs.end();

    time_t now;
    time(&now);
    
    // Check expiration if time is synced (> year 2001)
    if (exp > 0 && now > 1000000000 && now > exp) {
        return -1; // Expired
    }
    
    return 1; // Valid
}

void SecurityManager::syncAuthorizedRFIDs() {
    HTTPClient http;
    Serial.println("Syncing RFIDs from server...");
    Preferences prefsApp;
    prefsApp.begin("library-app", true);
    String libId = prefsApp.getString("libId", LIBRARY_ID);
    prefsApp.end();

    String url = String(API_SYNC_ENDPOINT) + "?libraryId=" + libId;
    http.begin(url);
    http.addHeader("Authorization", String("Bearer ") + API_HARDWARE_KEY);
    
    int httpResponseCode = http.GET();
    if (httpResponseCode > 0) {
        String payload = http.getString();
        StaticJsonDocument<4096> doc; // Adjust size as needed based on number of RFIDs
        DeserializationError error = deserializeJson(doc, payload);
        
        if (!error) {
            Preferences prefs;
            prefs.begin("rfid-auth", false);
            prefs.clear(); // Clear old list to handle revocations
            
            JsonArray arr = doc.as<JsonArray>();
            int count = 0;
            for (JsonObject v : arr) {
                String uid = v["uid"].as<String>();
                time_t exp = v["exp"].as<time_t>();
                prefs.putUInt(uid.c_str(), exp);
                count++;
            }
            prefs.end();
            Serial.printf("RFIDs Synced successfully. Count: %d\n", count);
        } else {
            Serial.print("Failed to parse JSON: ");
            Serial.println(error.c_str());
        }
    } else {
        Serial.printf("Error syncing RFIDs. HTTP Code: %d\n", httpResponseCode);
    }
    http.end();
}
