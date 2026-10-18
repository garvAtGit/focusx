# ESP32 QR Door Access Control Firmware

This folder contains the complete, production-ready Arduino firmware for the ESP32 QR Access Control system. 

## Features
- **Offline Capable:** Verifies ECDSA P-256 signatures offline using the ESP32's `mbedtls` engine. No internet required to open the door.
- **Robust Syncing:** Buffers logs in RAM when offline. If the RAM buffer gets too large (or power loss is imminent), it writes logs to the internal `LittleFS` storage safely. Automatically pushes to your Next.js backend when WiFi is restored.
- **WiFiManager:** Starts a Captive Portal (`FocusDesk_Door_AP`) on first boot. Connect with your phone to configure the WiFi credentials so you don't need to hardcode them.
- **Replay Protection:** Keeps a running cache of scanned QR IDs (`qid`) in RAM and purges them exactly when their 30-second TTL expires.

## Requirements
You must install the following libraries in your Arduino IDE via **Sketch -> Include Library -> Manage Libraries**:
1. `ArduinoJson` (v6 or v7) by Benoit Blanchon
2. `WiFiManager` by tzapu

## Configuration
Before flashing, open `config.h` and configure:
1. `LIBRARY_ID` - The Supabase ID of the library this device is installed in.
2. `API_HARDWARE_KEY` - A secure, long random string. This must exactly match the `RELAY_API_KEY` in your Next.js `.env` file so the backend accepts the logs.

## Hardware Connections
- **GM67 Scanner:** 
  - TX -> GPIO 16
  - RX -> GPIO 17
  - GND -> GND
  - VCC -> 3.3V or 5V (Check your specific GM67 voltage)
- **Relay / Maglock:**
  - IN / Trigger -> GPIO 4
  - GND -> GND
  - VCC -> 5V
