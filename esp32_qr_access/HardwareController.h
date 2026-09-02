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

private:
    bool isDoorUnlocked = false;
    unsigned long unlockStartTime = 0;
};

#endif // HARDWARE_CONTROLLER_H
