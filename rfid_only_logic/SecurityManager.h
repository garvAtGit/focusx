#ifndef SECURITY_MANAGER_H
#define SECURITY_MANAGER_H

#include <Arduino.h>

class SecurityManager {
public:
    SecurityManager();
    void init();
    
    // Check if UID is authorized (returns 1 for valid, -1 for expired, 0 for unknown)
    int checkRfidAuthorization(const String& uid);
    
    // API Sync to fetch authorized RFIDs
    void syncAuthorizedRFIDs();
};

#endif // SECURITY_MANAGER_H
