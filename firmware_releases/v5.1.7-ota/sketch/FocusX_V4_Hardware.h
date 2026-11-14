#line 1 "C:\\Users\\thees\\Compound\\Desktop\\01_Active Projects\\Library Near\\dashboard\\FocusX_Scanner_Firmware_V5_DualRFID\\FocusX_V4_Hardware.h"
#pragma once
#include <Arduino.h>
#include <Adafruit_NeoPixel.h>
#include <driver/i2s.h>
#include <math.h>

// =========================================================================
// FocusX V4 Hardware Subsystem Header
// Implements exact pin assignments & specs from Gate_System_V4_Production_Handover.md
// =========================================================================

// --- Pin Definitions ---
#define PIN_LCD_SDA       4
#define PIN_LCD_SCL       5
#define PIN_NEO_FRONT     6
#define PIN_I2S_BCLK      7
#define PIN_I2S_LRC       8
#define PIN_REED          9
#define PIN_I2S_DIN       10
#define PIN_NEO_LEFT      11
#define PIN_NEO_RIGHT     12
#define PIN_W1_D0         14
#define PIN_W1_D1         15
#define PIN_W2_D0         16
#define PIN_W2_D1         17
#define PIN_RDM6300_RX    18

#define NUM_LEDS_FRONT    4
#define NUM_LEDS_LEFT     4
#define NUM_LEDS_RIGHT    4
#define I2S_SAMPLE_RATE   16000

// --- NeoPixels ---
extern Adafruit_NeoPixel stripFront;
extern Adafruit_NeoPixel stripLeft;
extern Adafruit_NeoPixel stripRight;

inline void v4InitNeoPixels() {
  stripFront.begin();
  stripLeft.begin();
  stripRight.begin();
  for (int i = 0; i < 4; i++) {
    stripFront.setPixelColor(i, stripFront.Color(255, 0, 0));
    stripLeft.setPixelColor(i, stripLeft.Color(255, 0, 0));
    stripRight.setPixelColor(i, stripRight.Color(255, 0, 0));
  }
  stripFront.show();
  stripLeft.show();
  stripRight.show();
}

inline void v4SetAllStrips(uint32_t color) {
  for (int i = 0; i < 4; i++) {
    stripFront.setPixelColor(i, color);
    stripLeft.setPixelColor(i, color);
    stripRight.setPixelColor(i, color);
  }
  stripFront.show();
  stripLeft.show();
  stripRight.show();
}

inline void v4UpdateCountdown(int remainingSeconds) {
  // remainingSeconds: 0 to 10
  // 4 LEDs active countdown
  int ledsOn = 0;
  if (remainingSeconds >= 8) ledsOn = 4;
  else if (remainingSeconds >= 5) ledsOn = 3;
  else if (remainingSeconds >= 3) ledsOn = 2;
  else if (remainingSeconds >= 1) ledsOn = 1;
  else ledsOn = 0;

  uint32_t green = stripFront.Color(0, 255, 0);
  for (int i = 0; i < 4; i++) {
    stripFront.setPixelColor(i, (i < ledsOn) ? green : 0);
    stripLeft.setPixelColor(i, green);
    stripRight.setPixelColor(i, green);
  }
  stripFront.show();
  stripLeft.show();
  stripRight.show();
}

inline void v4PoliceStrobe(unsigned long nowMs) {
  bool phase = ((nowMs / 200) % 2) == 0;
  uint32_t colA = phase ? stripFront.Color(0, 0, 255) : stripFront.Color(255, 0, 0);
  uint32_t colB = phase ? stripFront.Color(255, 0, 0) : stripFront.Color(0, 0, 255);
  for (int i = 0; i < 4; i++) {
    stripFront.setPixelColor(i, colA);
    stripLeft.setPixelColor(i, colB);
    stripRight.setPixelColor(i, colA);
  }
  stripFront.show();
  stripLeft.show();
  stripRight.show();
}

// --- I2S Audio Engine (MAX98357A) ---
inline void v4InitI2S() {
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
    .sample_rate = I2S_SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 4,
    .dma_buf_len = 256,
    .use_apll = false,
    .tx_desc_auto_clear = true
  };
  i2s_pin_config_t pin_config = {
    .bck_io_num = PIN_I2S_BCLK,
    .ws_io_num = PIN_I2S_LRC,
    .data_out_num = PIN_I2S_DIN,
    .data_in_num = I2S_PIN_NO_CHANGE
  };
  i2s_driver_install(I2S_NUM_0, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_NUM_0, &pin_config);
  i2s_zero_dma_buffer(I2S_NUM_0);
  Serial.println("[AUDIO] MAX98357A I2S driver initialized on GPIO 7, 8, 10 @ 16kHz");
}

inline void v4PlayTone(float freqHz, int durationMs, float gain = 0.5f) {
  if (freqHz <= 0 || durationMs <= 0) return;
  size_t numSamples = (I2S_SAMPLE_RATE * durationMs) / 1000;
  int16_t sampleBuf[128 * 2]; // stereo: L, R
  size_t bytesWritten = 0;
  float phaseInc = (2.0f * M_PI * freqHz) / (float)I2S_SAMPLE_RATE;
  float phase = 0.0f;
  size_t samplesRemaining = numSamples;

  while (samplesRemaining > 0) {
    size_t chunk = (samplesRemaining > 128) ? 128 : samplesRemaining;
    for (size_t i = 0; i < chunk; i++) {
      int16_t s = (int16_t)(sinf(phase) * 16000.0f * gain);
      sampleBuf[i * 2] = s;     // Left
      sampleBuf[i * 2 + 1] = s; // Right
      phase += phaseInc;
      if (phase >= 2.0f * M_PI) phase -= 2.0f * M_PI;
    }
    i2s_write(I2S_NUM_0, sampleBuf, chunk * 4, &bytesWritten, portMAX_DELAY);
    samplesRemaining -= chunk;
  }
}

inline void v4PlayEntryChime() {
  // Ascending 3-note chime: C5 (523Hz) -> G5 (784Hz) -> C6 (1046Hz)
  v4PlayTone(523.25f, 120, 0.55f);
  v4PlayTone(783.99f, 120, 0.55f);
  v4PlayTone(1046.50f, 220, 0.60f);
}

inline void v4PlayExitChime() {
  // Descending 2-note chime: G5 (784Hz) -> C5 (523Hz)
  v4PlayTone(783.99f, 150, 0.55f);
  v4PlayTone(523.25f, 250, 0.55f);
}

inline void v4PlayIntrusionAlarm() {
  // Rapid frequency sweep 800Hz <-> 1550Hz
  for (float f = 800.0f; f <= 1550.0f; f += 75.0f) {
    v4PlayTone(f, 15, 0.65f);
  }
  for (float f = 1550.0f; f >= 800.0f; f -= 75.0f) {
    v4PlayTone(f, 15, 0.65f);
  }
}

inline void v4PlayDoorNag() {
  // Triple urgent pulse alert
  for (int i = 0; i < 3; i++) {
    v4PlayTone(1200.0f, 60, 0.65f);
    v4PlayTone(0.0f, 40, 0.0f);
  }
}

inline void v4StopAudio() {
  i2s_zero_dma_buffer(I2S_NUM_0);
}

// --- Wiegand Dual Readers (Entry & Exit) ---
static volatile uint64_t w1_bits = 0;
static volatile uint8_t w1_bitCount = 0;
static volatile unsigned long w1_lastPulse = 0;

static volatile uint64_t w2_bits = 0;
static volatile uint8_t w2_bitCount = 0;
static volatile unsigned long w2_lastPulse = 0;

static portMUX_TYPE wMux = portMUX_INITIALIZER_UNLOCKED;

static void isrW1_D0() {
  w1_bits = (w1_bits << 1);
  w1_bitCount++;
  w1_lastPulse = millis();
}
static void isrW1_D1() {
  w1_bits = (w1_bits << 1) | 1ULL;
  w1_bitCount++;
  w1_lastPulse = millis();
}

static void isrW2_D0() {
  w2_bits = (w2_bits << 1);
  w2_bitCount++;
  w2_lastPulse = millis();
}
static void isrW2_D1() {
  w2_bits = (w2_bits << 1) | 1ULL;
  w2_bitCount++;
  w2_lastPulse = millis();
}

inline void v4InitWiegand() {
  pinMode(PIN_W1_D0, INPUT_PULLUP);
  pinMode(PIN_W1_D1, INPUT_PULLUP);
  pinMode(PIN_W2_D0, INPUT_PULLUP);
  pinMode(PIN_W2_D1, INPUT_PULLUP);

  attachInterrupt(digitalPinToInterrupt(PIN_W1_D0), isrW1_D0, FALLING);
  attachInterrupt(digitalPinToInterrupt(PIN_W1_D1), isrW1_D1, FALLING);
  attachInterrupt(digitalPinToInterrupt(PIN_W2_D0), isrW2_D0, FALLING);
  attachInterrupt(digitalPinToInterrupt(PIN_W2_D1), isrW2_D1, FALLING);

  Serial.println("[WIEGAND] Readers armed: W1 Entry (D0:14, D1:15), W2 Exit (D0:16, D1:17)");
}

inline bool v4CheckWiegand(int readerNum, char* outHex, size_t maxLen, uint32_t &outDec) {
  volatile uint64_t &rBits = (readerNum == 1) ? w1_bits : w2_bits;
  volatile uint8_t &rCount = (readerNum == 1) ? w1_bitCount : w2_bitCount;
  volatile unsigned long &rLast = (readerNum == 1) ? w1_lastPulse : w2_lastPulse;

  if (rCount == 0) return false;
  if (millis() - rLast < 25) return false; // Still bursting

  taskENTER_CRITICAL(&wMux);
  uint64_t bits = rBits;
  uint8_t count = rCount;
  rBits = 0;
  rCount = 0;
  taskEXIT_CRITICAL(&wMux);

  if (count < 8) return false; // Glitch

  uint32_t cardData = 0;
  if (count == 26) {
    cardData = (uint32_t)((bits >> 1) & 0xFFFFFF);
    outDec = (uint32_t)((bits >> 1) & 0xFFFF);
    snprintf(outHex, maxLen, "%06X", (unsigned int)cardData);
  } else if (count == 34) {
    cardData = (uint32_t)((bits >> 1) & 0xFFFFFFFF);
    outDec = cardData;
    snprintf(outHex, maxLen, "%08X", (unsigned int)cardData);
  } else {
    cardData = (uint32_t)(bits & 0xFFFFFFFF);
    outDec = cardData;
    snprintf(outHex, maxLen, "%08X", (unsigned int)cardData);
  }
  return true;
}

// --- RDM6300 125kHz UART Reader ---
inline void v4InitRDM6300() {
  Serial1.begin(9600, SERIAL_8N1, PIN_RDM6300_RX, -1);
  Serial.println("[RDM6300] Desk reader armed on GPIO 18 @ 9600 baud");
}

inline bool v4CheckRDM6300(char* outHex, size_t maxLen) {
  static char rdmBuf[16];
  static uint8_t rdmIdx = 0;

  while (Serial1.available()) {
    uint8_t b = Serial1.read();
    if (b == 0x02) {
      rdmIdx = 0;
      continue;
    }
    if (b == 0x03) {
      if (rdmIdx >= 10) {
        rdmBuf[10] = '\0';
        snprintf(outHex, maxLen, "%s", rdmBuf);
        rdmIdx = 0;
        return true;
      }
      rdmIdx = 0;
      continue;
    }
    if (rdmIdx < 14) {
      rdmBuf[rdmIdx++] = (char)b;
    }
  }
  return false;
}

// --- Reed Switch ---
inline void v4InitReedSwitch() {
  pinMode(PIN_REED, INPUT_PULLUP);
  Serial.println("[REED] MC-38 contact armed on GPIO 9 (INPUT_PULLUP)");
}

inline bool v4IsDoorOpen() {
  return digitalRead(PIN_REED) == HIGH;
}
