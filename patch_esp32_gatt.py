import re

with open("FocusX_Scanner_Firmware_V5_DualRFID/FocusX_Scanner_Firmware_V5_DualRFID.ino", "r") as f:
    content = f.read()

# Add Server Callbacks and characteristic callbacks
callbacks = """
// ================= BLE GATT =================

#define SERVICE_UUID        "87b99b2c-90fd-11e9-bc42-526af7764f64"
#define CHARACTERISTIC_UUID "87b99b2c-90fd-11e9-bc42-526af7764f65"

class MyServerCallbacks: public NimBLEServerCallbacks {
    void onConnect(NimBLEServer* pServer) {
      Serial.println("Phone connected via BLE!");
    }
    void onDisconnect(NimBLEServer* pServer) {
      Serial.println("Phone disconnected from BLE.");
      // restart advertising
      NimBLEDevice::startAdvertising();
    }
};

class MyCallbacks: public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic *pCharacteristic) {
      std::string value = pCharacteristic->getValue();
      if (value.length() > 0) {
        Serial.print("Received Value: ");
        for (int i = 0; i < value.length(); i++)
          Serial.print(value[i]);
        Serial.println();
        
        if (value == "UNLOCK_IN") {
          Serial.println("BLE UNLOCK_IN received!");
          remoteOpenIn = true;
        } else if (value == "UNLOCK_OUT") {
          Serial.println("BLE UNLOCK_OUT received!");
          remoteOpenOut = true;
        }
      }
    }
};
"""

# Insert callbacks before initBLE
content = re.sub(r'(void initBLE\(\) \{)', callbacks + r'\n\1', content)

# Modify initBLE to add the server
init_ble_replacement = """void initBLE() {
  NimBLEDevice::init("FocusX_Beacon");
  NimBLEServer *pServer = NimBLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  NimBLEService *pService = pServer->createService(SERVICE_UUID);
  NimBLECharacteristic *pCharacteristic = pService->createCharacteristic(
                                         CHARACTERISTIC_UUID,
                                         NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR
                                       );
  pCharacteristic->setCallbacks(new MyCallbacks());
  pService->start();

  NimBLEAdvertising *pAdvertising = NimBLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  
  uint8_t payload[25];
  payload[0] = 0x4C; // Apple LSB
  payload[1] = 0x00; // Apple MSB
  payload[2] = 0x02; // iBeacon Type
  payload[3] = 0x15; // Length
  uint8_t uuid[16] = {0x87, 0xb9, 0x9b, 0x2c, 0x90, 0xfd, 0x11, 0xe9, 0xbc, 0x42, 0x52, 0x6a, 0xf7, 0x76, 0x4f, 0x64};
  memcpy(&payload[4], uuid, 16);
  payload[20] = 0x00; // Major MSB
  payload[21] = 0x01; // Major LSB
  payload[22] = 0x00; // Minor MSB
  payload[23] = 0x01; // Minor LSB
  payload[24] = 0xC5; // TX Power
  
  NimBLEAdvertisementData oAdvertisementData = NimBLEAdvertisementData();
  oAdvertisementData.setFlags(0x06); // 0x06 ensures general discoverable and connectable
  oAdvertisementData.setManufacturerData(std::string((char*)payload, 25));
  pAdvertising->setAdvertisementData(oAdvertisementData);

  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  pAdvertising->start();
  Serial.println("BLE Beacon & GATT Server started");
}"""

# Replace initBLE function
content = re.sub(r'void initBLE\(\) \{.*?(?=void setup\(\))', init_ble_replacement + '\n\n', content, flags=re.DOTALL)

with open("FocusX_Scanner_Firmware_V5_DualRFID/FocusX_Scanner_Firmware_V5_DualRFID.ino", "w") as f:
    f.write(content)

print("Patched ESP32 code!")
