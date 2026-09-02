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
    String failReason;
    
    // Provisioning fields
    String cmd;
    String ssid;
    String pass;
    String libId;
    
    // RFID Command fields
    String rfid;
    time_t exp;
};

class SecurityManager {
public:
    SecurityManager();
    void init();
    
    // Parse JSON, verify ECDSA signature, age, and replay
    QRPayload processQR(const String& rawJson);
    
    // Purge expired QIDs from RAM
    void purgeReplayCache();

private:
    std::vector<ReplayEntry> replayCache;
    
    bool verifyECDSASignature(const String& payload, const String& signatureBase64);
    bool checkReplay(const String& qid, time_t expiry);
};

#endif // SECURITY_MANAGER_H
