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
    unlockStartTime = millis();
}

void HardwareController::process() {
    if (isDoorUnlocked) {
        if (millis() - unlockStartTime >= DOOR_UNLOCK_TIME_MS) {
            Serial.println("Locking Door.");
            digitalWrite(RELAY_PIN, LOW);
            isDoorUnlocked = false;
        }
    }
}
