#ifndef HARDWARE_CONTROLLER_H
#define HARDWARE_CONTROLLER_H

#include <Arduino.h>
#include <LiquidCrystal_I2C.h>

class HardwareController {
public:
    HardwareController();
    void init();
    
    // Unlock the door for the configured duration (non-blocking)
    void unlockDoor();
    
    // Call this inside loop() to handle the non-blocking delay
    void process();

    // LCD display functions
    void showIdle();
    void showWelcome();
    void showError(const String& error);
    void showWiFiConnecting();
    void showMessage(const String& line1, const String& line2, int timeoutMs = 0);

private:
    bool isDoorUnlocked = false;
    unsigned long unlockStartTime = 0;
    
    LiquidCrystal_I2C lcd;
    
    unsigned long lcdMessageStartTime = 0;
    unsigned long lcdMessageTimeout = 0;
    bool isTemporaryMessage = false;
};

#endif // HARDWARE_CONTROLLER_H
