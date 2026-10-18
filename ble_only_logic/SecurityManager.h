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
    
    // RFID Provisioning fields
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

    // RFID authorization checks
    void addRfidToNVS(const String& uid, time_t exp);
    void removeRfidFromNVS(const String& uid);
    int checkRfidAuthorization(const String& uid); // 1 = Valid, 0 = Not Found, -1 = Expired

private:
    std::vector<ReplayEntry> replayCache;
    
    bool verifyECDSASignature(const String& payload, const String& signatureBase64);
    bool checkReplay(const String& qid, time_t expiry);
};

#endif // SECURITY_MANAGER_H
