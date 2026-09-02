#ifndef LOG_MANAGER_H
#define LOG_MANAGER_H

#include <Arduino.h>
#include <vector>

struct LogEntry {
    String uid;
    String doorId;
    time_t timestamp;
};

class LogManager {
public:
    LogManager();
    void init();
    
    // Add log to RAM buffer, attempts upload if online. If fails, stays in RAM/Flash.
    void addLog(const String& uid, const String& doorId, time_t timestamp);
    
    // Periodic sync function (call from loop)
    void sync();

private:
    std::vector<LogEntry> ramLogs;
    unsigned long lastSyncAttempt = 0;
    
    void saveToFlash();
    bool uploadBatch(const String& jsonPayload);
    bool uploadRamLogs();
    bool uploadFlashLogs();
};

#endif // LOG_MANAGER_H
