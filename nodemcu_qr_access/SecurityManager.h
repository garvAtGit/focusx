#ifndef SECURITY_MANAGER_H
#define SECURITY_MANAGER_H

#include <Arduino.h>
#include <vector>

struct ReplayEntry {
    String qid;
    time_t expiry;
};

struct QRPayload {
    String uid;
    time_t iat;
    String qid;
    String doorId;
    String sig;
    bool isValid;
};

struct WiFiConfigPayload {
    String ssid;
    String pass;
    time_t iat;
    String qid;
    String sig;
    bool isValid;
};

class SecurityManager {
public:
    SecurityManager();
    void init();
    
    // Detect QR type: returns "access" or "wifi"
    String detectQRType(const String& rawJson);
    
    // Parse JSON, verify ECDSA signature, age, and replay for access QR
    QRPayload processQR(const String& rawJson);
    
    // Parse JSON, verify ECDSA signature, age, and replay for WiFi config QR
    WiFiConfigPayload processWiFiQR(const String& rawJson);
    
    // Purge expired QIDs from RAM
    void purgeReplayCache();

private:
    std::vector<ReplayEntry> replayCache;
    
    bool verifyECDSASignature(const String& payload, const String& signatureBase64);
    bool checkReplay(const String& qid, time_t expiry);
    int base64Decode(const char* input, size_t inputLen, unsigned char* output, size_t outputMaxLen);
};

#endif // SECURITY_MANAGER_H
