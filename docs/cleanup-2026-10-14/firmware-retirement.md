# Firmware retirement - second cleanup pass

The supported firmware is V5 DualRFID. The user explicitly retires V1-V3 and discontinues physical QR scanner hardware. Firmware implementations were inspected statically; no device was contacted or flashed.

## Retired directories

- `FocusX_Scanner_Firmware/`
- `FocusX_Scanner_Firmware_V2/`
- `FocusX_Scanner_Firmware_V3/`
- `FocusX_Scanner_Firmware_V4/`
- `esp32_qr_access/`

V1-V3 are explicitly retired. V4 and the original ESP32 QR implementation belong to the retired QR/single-reader generation. No package, deployment, test, CI or supported source consumer was found. Current supported-hardware retirement is based on the user decision, not a claim that deployed physical doors were inventoried. All 13 source files in these five directories were individually hash-checked against Git checkout-filtered content before removal.

## Preserved directories

- `FocusX_Scanner_Firmware_V5_DualRFID/`
- `ble_only_logic/`
- `nodemcu_qr_access/`
- `esp32_qr_access_changed/`

Every one of the 30 files in these four directories is byte-for-byte unchanged, including V5 internal `.ino.backup`, examples, headers and configuration.

- V5: active dual-PN532/NimBLE/FreeRTOS implementation, unchanged.
- `ble_only_logic/`: ECDSA verification and reusable BLE/offline security.
- `nodemcu_qr_access/`: LittleFS persistent event queue and replay.
- `esp32_qr_access_changed/`: ECDSA and LittleFS interfaces retain the original QR implementation's reusable security/journaling methods, with added RFID authorization methods.
- `rfid_only_logic/`: retained separately because Preferences/NVS authorization and persistent LittleFS event logging are absent from V5; eight files unchanged.

## Snapshots and patching workflow

`current.ino` was retired with the older QR/single-reader generation. The root empty V5 `.ino` was removed after retiring its historical patching workflow; the real nested V5 sketch remains. The Oct3 ZIP was inspected: its backup matches the preserved V5 internal backup; its sketch differs from current V5 and was intentionally retired as a Git-recoverable historical snapshot. Recovered snippets and agent-transcript extractors were historical one-time reconstruction work, not firmware flashing/provisioning tools. Serial readers and `scripts/generate-ec-keys.js` remain.

## Recovery and validation

Known recovery commit: `90c4b5a1700d3f5308086aa1f42f8f9dff5289ee`. Every file appears individually in [removed-files.csv](removed-files.csv) with its original SHA-256 and an exact-path recovery command. Use recovery only when the destination is absent; preserve any later user changes. No duplicate plaintext firmware/secret archive was created.

Firmware compilation: NOT RUN - unavailable (Arduino CLI/core/libraries are not installed). Offline behavior and physical door compatibility are not runtime-verified. Existing API/device contracts and active V5 behavior remain unchanged.
