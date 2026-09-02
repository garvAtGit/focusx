#include "LogManager.h"
#include "config.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include <Preferences.h>

const char* OFFLINE_LOG_FILE = "/offline_logs.txt";

LogManager::LogManager() {}

void LogManager::init() {
    if (!LittleFS.begin(true)) {
        Serial.println("LittleFS Mount Failed");
        return;
    }
}

void LogManager::addLog(const String& uid, const String& doorId, time_t timestamp, const String& status, const String& reason) {
    ramLogs.push_back({uid, doorId, timestamp, status, reason});
    
    // Attempt upload immediately if connected
    if (WiFi.status() == WL_CONNECTED) {
        if (uploadRamLogs()) {
            return; // Success!
        }
    }
    
    // If we reach here, upload failed or offline.
    Serial.println("Log buffered in RAM.");
    
    // If RAM buffer is too large, save to flash to prevent data loss on reset
    if (ramLogs.size() >= 30) {
        saveToFlash();
    }
}

void LogManager::sync() {
    // Only attempt sync every 10 seconds to avoid spamming the network
    if (millis() - lastSyncAttempt < 10000) return;
    lastSyncAttempt = millis();

    if (WiFi.status() != WL_CONNECTED) return;

    // 1. Upload any pending flash logs first
    if (LittleFS.exists(OFFLINE_LOG_FILE)) {
        uploadFlashLogs();
    }

    // 2. Upload any RAM logs
    if (!ramLogs.empty()) {
        uploadRamLogs();
    }
}

bool LogManager::uploadBatch(const String& jsonPayload) {
    HTTPClient http;
    http.begin(API_LOG_ENDPOINT);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-api-key", API_HARDWARE_KEY);
    
    int httpResponseCode = http.POST(jsonPayload);
    
    bool success = false;
    if (httpResponseCode == 200) {
        success = true;
    } else {
        Serial.print("Error sending POST, code: ");
        Serial.println(httpResponseCode);
    }
    
    http.end();
    return success;
}

bool LogManager::uploadRamLogs() {
    if (ramLogs.empty()) return true;

    Preferences prefs;
    prefs.begin("library-app", true);
    String libId = prefs.getString("libId", LIBRARY_ID);
    prefs.end();

    // Create JSON Payload
    DynamicJsonDocument doc(4096);
    doc["libraryId"] = libId;
    JsonArray logsArray = doc.createNestedArray("logs");
    
    for (const auto& entry : ramLogs) {
        JsonObject logObj = logsArray.createNestedObject();
        logObj["uid"] = entry.uid;
        logObj["doorId"] = entry.doorId;
        logObj["timestamp"] = entry.timestamp;
        logObj["status"] = entry.status;
        if (entry.reason.length() > 0) {
            logObj["reason"] = entry.reason;
        }
    }

    String requestBody;
    serializeJson(doc, requestBody);

    if (uploadBatch(requestBody)) {
        Serial.println("RAM logs uploaded successfully.");
        ramLogs.clear();
        return true;
    }
    
    return false;
}

void LogManager::saveToFlash() {
    Serial.println("Saving RAM logs to Flash backup.");
    
    DynamicJsonDocument doc(4096);
    JsonArray logsArray = doc.to<JsonArray>();
    
    for (const auto& entry : ramLogs) {
        JsonObject logObj = logsArray.createNestedObject();
        logObj["uid"] = entry.uid;
        logObj["doorId"] = entry.doorId;
        logObj["timestamp"] = entry.timestamp;
        logObj["status"] = entry.status;
        if (entry.reason.length() > 0) {
            logObj["reason"] = entry.reason;
        }
    }
    
    File file = LittleFS.open(OFFLINE_LOG_FILE, FILE_APPEND);
    if (!file) {
        Serial.println("Failed to open file for appending");
        return;
    }
    
    serializeJson(doc, file);
    file.println(); // newline separator for batches
    file.close();
    
    ramLogs.clear(); // Clear RAM after saving to flash
}

bool LogManager::uploadFlashLogs() {
    File file = LittleFS.open(OFFLINE_LOG_FILE, FILE_READ);
    if (!file) {
        return false;
    }

    Preferences prefs;
    prefs.begin("library-app", true);
    String libId = prefs.getString("libId", LIBRARY_ID);
    prefs.end();

    bool allUploaded = true;
    String newFileContent = "";

    // Read line by line (each line is a batch of max 30 logs)
    while (file.available()) {
        String line = file.readStringUntil('\n');
        line.trim();
        if (line.length() == 0) continue;

        // Parse the stored array
        DynamicJsonDocument doc(4096);
        DeserializationError error = deserializeJson(doc, line);
        
        if (!error) {
            // We need to wrap it with libraryId for the API payload
            DynamicJsonDocument wrapper(4096);
            wrapper["libraryId"] = libId;
            wrapper["logs"] = doc.as<JsonArray>();
            
            String requestBody;
            serializeJson(wrapper, requestBody);
            
            if (uploadBatch(requestBody)) {
                Serial.println("Flash log batch uploaded!");
            } else {
                allUploaded = false;
                newFileContent += line + "\n"; // Keep failed batch
            }
        }
    }
    file.close();

    // If some batches failed, rewrite the file with only the failed ones
    if (allUploaded) {
        LittleFS.remove(OFFLINE_LOG_FILE);
    } else {
        File fileWrite = LittleFS.open(OFFLINE_LOG_FILE, FILE_WRITE);
        fileWrite.print(newFileContent);
        fileWrite.close();
    }

    return allUploaded;
}
