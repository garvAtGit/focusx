#include "HardwareController.h"
#include "config.h"

HardwareController::HardwareController() {}

void HardwareController::init() {
    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, LOW); // Assume active HIGH relay
}

void HardwareController::unlockDoor() {
    Serial.println("Unlocking Door!");
    digitalWrite(RELAY_PIN, HIGH);
    isDoorUnlocked = true;
    justLockedFlag = false;
    unlockStartTime = millis();
}

void HardwareController::process() {
    if (isDoorUnlocked) {
        if (millis() - unlockStartTime >= (unsigned long)DOOR_UNLOCK_TIME_MS) {
            Serial.println("Locking Door.");
            digitalWrite(RELAY_PIN, LOW);
            isDoorUnlocked = false;
            justLockedFlag = true;
        }
    }
}

bool HardwareController::isUnlocked() {
    return isDoorUnlocked;
}

bool HardwareController::checkJustLocked() {
    if (justLockedFlag) {
        justLockedFlag = false;
        return true;
    }
    return false;
}
