#ifndef HARDWARE_CONTROLLER_H
#define HARDWARE_CONTROLLER_H

#include <Arduino.h>

class HardwareController {
public:
    HardwareController();
    void init();
    
    // Unlock the door for the configured duration (non-blocking)
    void unlockDoor();
    
    // Call this inside loop() to handle the non-blocking delay
    void process();
    
    // Returns true if door is currently unlocked
    bool isUnlocked();
    
    // Returns true once when the door transitions from unlocked -> locked
    // Used by main sketch to update LCD back to idle message
    bool checkJustLocked();

private:
    bool isDoorUnlocked = false;
    unsigned long unlockStartTime = 0;
    bool justLockedFlag = false;
};

#endif // HARDWARE_CONTROLLER_H
