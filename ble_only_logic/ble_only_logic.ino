#include <Arduino.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ArduinoJson.h>

#include "config.h"
#include "SecurityManager.h"
#include "LogManager.h"
#include "HardwareController.h"

// UUIDs for the BLE Service and Characteristic
#define SERVICE_UUID           "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID    "beb5483e-36e1-4688-b7f5-ea07361b26a8"

SecurityManager securityManager;
LogManager logManager;
HardwareController hwController;

BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
      hwController.showMessage(" BLE Connected! ", " Waiting 4 Auth ", 1000);
    };

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      hwController.showMessage(" BLE Disconnected", " Ready for BLE!  ", 1000);
    }
};

class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String payload = pCharacteristic->getValue();

      if (payload.length() > 0) {
        Serial.println("Received BLE Payload: " + payload);

        QRPayload result = securityManager.processQR(payload);

        if (result.isValid) {
            Serial.println("BLE Auth Success!");
            hwController.showWelcome();
            hwController.unlockDoor();
            
            time_t now;
            time(&now);
            logManager.addLog(result.uid, String(DOOR_ID), now, "IN", "BLE");
            
            pCharacteristic->setValue("SUCCESS");
            pCharacteristic->notify();
        } else {
            Serial.println("BLE Auth Failed: " + result.failReason);
            hwController.showMessage(" Access Denied! ", " Invalid Auth ", 3000);
            
            time_t now;
            time(&now);
            logManager.addLog(result.uid, String(DOOR_ID), now, "DENIED", result.failReason);
            
            pCharacteristic->setValue("FAILED");
            pCharacteristic->notify();
        }
      }
    }
};

void setup() {
    Serial.begin(115200);
    hwController.init();
    hwController.showMessage("  Booting up... ", "", 1000);
    
    logManager.init();
    securityManager.init();
    
    // WiFiManager Setup (Captive Portal)
    WiFiManager wm;
    hwController.showMessage(" Connect to WiFi", " AP: LibrarySetup", 0);
    
    bool res = wm.autoConnect("LibrarySetup-BLE");
    if(!res) {
        Serial.println("Failed to connect to WiFi");
        hwController.showMessage(" WiFi Failed ", " Restarting... ", 2000);
        ESP.restart();
    } 
    
    Serial.println("Connected to WiFi!");
    hwController.showMessage(" WiFi Connected ", WiFi.localIP().toString(), 2000);
    
    // Sync Time for ECDSA validation
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
    hwController.showMessage(" Syncing NTP... ", "", 1000);
    
    // Create the BLE Device
    BLEDevice::init("FocusX-Main-Door");

    // Create the BLE Server
    pServer = BLEDevice::createServer();
    pServer->setCallbacks(new MyServerCallbacks());

    // Create the BLE Service
    BLEService *pService = pServer->createService(SERVICE_UUID);

    // Create a BLE Characteristic
    pCharacteristic = pService->createCharacteristic(
                        CHARACTERISTIC_UUID,
                        BLECharacteristic::PROPERTY_READ   |
                        BLECharacteristic::PROPERTY_WRITE  |
                        BLECharacteristic::PROPERTY_NOTIFY |
                        BLECharacteristic::PROPERTY_INDICATE
                      );

    pCharacteristic->setCallbacks(new MyCallbacks());
    pCharacteristic->addDescriptor(new BLE2902());

    // Start the service
    pService->start();

    // Start advertising
    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x0);  // set value to 0x00 to not advertise this parameter
    BLEDevice::startAdvertising();
    
    Serial.println("Waiting a client connection to notify...");
    hwController.showMessage(" All Set Up! [\x01]", " Ready for BLE! ", 3000);
}

void loop() {
    hwController.process();
    logManager.sync(); // Background sync offline logs to Vercel

    // Disconnecting
    if (!deviceConnected && oldDeviceConnected) {
        delay(500); // give the bluetooth stack the chance to get things ready
        pServer->startAdvertising(); // restart advertising
        Serial.println("Restart advertising");
        oldDeviceConnected = deviceConnected;
    }
    // Connecting
    if (deviceConnected && !oldDeviceConnected) {
        oldDeviceConnected = deviceConnected;
    }
    
    delay(50);
}
