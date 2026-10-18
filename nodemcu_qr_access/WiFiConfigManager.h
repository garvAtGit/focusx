#ifndef WIFI_CONFIG_MANAGER_H
#define WIFI_CONFIG_MANAGER_H

#include <Arduino.h>

class WiFiConfigManager {
public:
    WiFiConfigManager();
    void init();
    
    // Check if custom credentials are stored in LittleFS
    bool hasStoredCredentials();
    
    // Getters for stored credentials
    String getStoredSSID();
    String getStoredPassword();
    
    // Save new credentials to LittleFS, disconnect, reconnect, and re-sync NTP
    bool applyNewCredentials(const String& ssid, const String& password);

private:
    String storedSSID;
    String storedPassword;
    bool credentialsLoaded;
    
    void syncNTP();
};

#endif // WIFI_CONFIG_MANAGER_H
