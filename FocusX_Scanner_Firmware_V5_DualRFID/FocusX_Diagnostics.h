#ifndef FOCUSX_DIAGNOSTICS_H
#define FOCUSX_DIAGNOSTICS_H

#include <Arduino.h>
#include <LittleFS.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <esp_task_wdt.h>
#include <rom/crc.h>
#include <esp_system.h>
#include "FocusX_Reliability.h"

enum DiagSeverity : uint8_t {
  DIAG_SEV_INFO = 0,
  DIAG_SEV_WARN = 1,
  DIAG_SEV_ERROR = 2,
  DIAG_SEV_CRITICAL = 3,
  DIAG_SEV_FATAL = 4
};

enum DiagEventCode : uint16_t {
  // 1000 - 1099: System & Boot
  DIAG_CODE_BOOT_SUCCESS           = 1000,
  DIAG_CODE_RESET_REASON           = 1001,
  DIAG_CODE_WDT_WARN               = 1002,
  DIAG_CODE_HEAP_LOW               = 1003,

  // 2000 - 2099: RFID / Readers
  DIAG_CODE_NFC1_TIMEOUT           = 2000,
  DIAG_CODE_NFC2_TIMEOUT           = 2001,
  DIAG_CODE_NFC_MUTEX_TIMEOUT      = 2002,
  DIAG_CODE_NFC1_INIT_FAIL         = 2003,
  DIAG_CODE_NFC2_INIT_FAIL         = 2004,

  // 3000 - 3099: LittleFS & Storage
  DIAG_CODE_STORAGE_WARN_LOW       = 3000,
  DIAG_CODE_STORAGE_CRIT_FULL      = 3001,
  DIAG_CODE_JOURNAL_WRITE_FAIL     = 3002,
  DIAG_CODE_LITTLEFS_MOUNT_FAIL    = 3003,

  // 4000 - 4099: Security & Snapshot
  DIAG_CODE_SNAPSHOT_INVALID       = 4000,
  DIAG_CODE_SNAPSHOT_SIG_FAIL      = 4001,
  DIAG_CODE_CLOCK_DESYNC           = 4002,
  DIAG_CODE_BLE_REPLAY_WARN        = 4003,

  // 5000 - 5099: Network & Sync
  DIAG_CODE_WIFI_DISCONNECT        = 5000,
  DIAG_CODE_WIFI_RECONNECT         = 5001,
  DIAG_CODE_HTTP_ERROR             = 5002,
  DIAG_CODE_HEARTBEAT_TIMEOUT      = 5003,

  // 6000 - 6099: Door / Gate
  DIAG_CODE_DOOR_HELD_OPEN         = 6000
};

#define DIAG_DETAIL_MAX_LEN 193
#define DIAG_EVENT_ID_LEN 64
#define DIAG_RING_CAPACITY 64
#define DIAG_FLASH_JOURNAL_PATH "/diag_critical.bin"
#define DIAG_FLASH_MAX_BYTES 16384
#define DIAG_MIN_LITTLEFS_FREE 30000

struct DiagEventRecord {
  char eventId[DIAG_EVENT_ID_LEN];
  uint16_t eventCode;
  uint8_t severity;
  uint32_t timestamp;
  uint32_t uptimeMs;
  int32_t param1;
  uint32_t param2;
  char detail[DIAG_DETAIL_MAX_LEN];
  bool inUse;
};

class FocusXDiagnostics {
private:
  DiagEventRecord ring[DIAG_RING_CAPACITY];
  uint16_t head;
  uint16_t tail;
  uint16_t count;
  uint32_t droppedCount;
  uint32_t sequenceId;
  portMUX_TYPE mux;
  char resetReasonStr[32];
  unsigned long lastFlushAttemptMs;
  unsigned long flushBackoffMs;
  char devicePrefix[16];
  uint32_t bootNonce[2];
  uint32_t journalGeneration = 0, persistedCrc = 0, persistedCount = 0, lastPersistMs = 0;
  bool persistedOnce = false;

public:
  FocusXDiagnostics() : head(0), tail(0), count(0), droppedCount(0), sequenceId(0),
                        lastFlushAttemptMs(0), flushBackoffMs(30000) {
    vPortCPUInitializeMutex(&mux);
    memset(ring, 0, sizeof(ring));
    strncpy(resetReasonStr, "UNKNOWN", sizeof(resetReasonStr));
    memset(devicePrefix, 0, sizeof(devicePrefix));
  }

  void init(const char* devId) {
    bootNonce[0] = esp_random(); bootNonce[1] = esp_random();
    if (devId && strlen(devId) > 0) {
      strncpy(devicePrefix, devId, 15);
      devicePrefix[15] = '\0';
    } else {
      strncpy(devicePrefix, "esp32", 15);
    }

    esp_reset_reason_t reason = esp_reset_reason();
    switch (reason) {
      case ESP_RST_POWERON:   strncpy(resetReasonStr, "POWERON_RESET", sizeof(resetReasonStr)); break;
      case ESP_RST_SW:        strncpy(resetReasonStr, "SW_RESET", sizeof(resetReasonStr)); break;
      case ESP_RST_PANIC:     strncpy(resetReasonStr, "PANIC_RESET", sizeof(resetReasonStr)); break;
      case ESP_RST_INT_WDT:   strncpy(resetReasonStr, "INT_WDT_RESET", sizeof(resetReasonStr)); break;
      case ESP_RST_TASK_WDT:  strncpy(resetReasonStr, "TASK_WDT_RESET", sizeof(resetReasonStr)); break;
      case ESP_RST_WDT:       strncpy(resetReasonStr, "OTHER_WDT_RESET", sizeof(resetReasonStr)); break;
      case ESP_RST_DEEPSLEEP: strncpy(resetReasonStr, "DEEPSLEEP_RESET", sizeof(resetReasonStr)); break;
      case ESP_RST_BROWNOUT:  strncpy(resetReasonStr, "BROWNOUT_RESET", sizeof(resetReasonStr)); break;
      case ESP_RST_SDIO:      strncpy(resetReasonStr, "SDIO_RESET", sizeof(resetReasonStr)); break;
      default:                strncpy(resetReasonStr, "UNKNOWN_RESET", sizeof(resetReasonStr)); break;
    }

    // Capture initial boot diagnostic event
    DiagSeverity severity = (reason == ESP_RST_PANIC || reason == ESP_RST_INT_WDT || reason == ESP_RST_TASK_WDT || reason == ESP_RST_WDT)
      ? DIAG_SEV_CRITICAL : reason == ESP_RST_BROWNOUT ? DIAG_SEV_ERROR : DIAG_SEV_INFO;
    capture(DIAG_CODE_RESET_REASON, severity, (int32_t)reason, ESP.getFreeHeap(), resetReasonStr);
  }

  const char* getResetReason() const { return resetReasonStr; }
  uint16_t getQueueDepth() { taskENTER_CRITICAL(&mux); uint16_t n = count; taskEXIT_CRITICAL(&mux); return n; }
  uint32_t getDroppedCount() { taskENTER_CRITICAL(&mux); uint32_t n = droppedCount; taskEXIT_CRITICAL(&mux); return n; }

  // Fixed-size slot pool; capture never touches flash or allocates heap memory.
  bool capture(DiagEventCode code, DiagSeverity sev, int32_t p1 = 0, uint32_t p2 = 0, const char* detail = nullptr) {
    DiagEventRecord rec = {};
    uint32_t nowEpoch = (uint32_t)time(nullptr);
    rec.timestamp = nowEpoch > 1700000000 ? nowEpoch : 0;
    rec.uptimeMs = millis(); rec.eventCode = code; rec.severity = sev;
    rec.param1 = p1; rec.param2 = p2; rec.inUse = true;
    if (detail) strlcpy(rec.detail, detail, sizeof(rec.detail));
    taskENTER_CRITICAL(&mux);
    uint32_t seq = ++sequenceId;
    taskEXIT_CRITICAL(&mux);
    snprintf(rec.eventId, sizeof(rec.eventId), "%012llx_%08lx%08lx_%08lx",
      ESP.getEfuseMac(), (unsigned long)bootNonce[0], (unsigned long)bootNonce[1], (unsigned long)seq);
    taskENTER_CRITICAL(&mux);
    int slot = -1;
    for (uint16_t i = 0; i < DIAG_RING_CAPACITY; ++i) {
      if (!ring[i].inUse) { slot = i; break; }
    }
    if (slot < 0) {
      for (uint16_t i = 0; i < DIAG_RING_CAPACITY; ++i) {
        if (ring[i].severity < sev && ring[i].eventCode != 1010 && ring[i].eventCode != 1011) { slot = i; break; }
      }
      ++droppedCount;
    } else { ++count; }
    if (slot >= 0) ring[slot] = rec;
    taskEXIT_CRITICAL(&mux);
    return slot >= 0;
  }

  // Worker-only insertion of deterministic core-dump chunk IDs for retry deduplication.
  bool enqueueExternal(DiagEventRecord rec) {
    rec.inUse = true; rec.uptimeMs = millis(); rec.timestamp = 0;
    taskENTER_CRITICAL(&mux);
    bool inserted = false;
    for (uint16_t i = 0; i < DIAG_RING_CAPACITY; ++i) if (!ring[i].inUse) {
      ring[i] = rec; ++count; inserted = true; break;
    }
    taskEXIT_CRITICAL(&mux);
    return inserted;
  }

  // Worker-only A/B journal. Flash operations never run in capture or under its spinlock.
  // Call under the shared journal task mutex. The older complete slot survives torn writes.
  void restoreCritical() {
    uint32_t bestGeneration = 0;
    const char* bestPath = nullptr;
    for (const char* path : {"/diag_A.bin", "/diag_B.bin"}) {
      File f = LittleFS.open(path, "r");
      uint32_t header[4];
      if (!f || f.read((uint8_t*)header, sizeof(header)) != sizeof(header)
          || header[0] != 0x46584432 || header[2] > 32) { if (f) f.close(); continue; }
      uint32_t crc = 0; DiagEventRecord rec;
      bool valid = true;
      for (uint32_t i = 0; i < header[2]; ++i) {
        if (f.read((uint8_t*)&rec, sizeof(rec)) != sizeof(rec)) { valid = false; break; }
        crc = crc32_le(crc, (uint8_t*)&rec, sizeof(rec));
        if (rec.eventId[DIAG_EVENT_ID_LEN-1] || rec.detail[DIAG_DETAIL_MAX_LEN-1]) valid = false;
      }
      if (valid && crc == header[3] && header[1] >= bestGeneration) { bestGeneration = header[1]; bestPath = path; }
      f.close();
    }
    journalGeneration = bestGeneration;
    if (!bestPath) return;
    File f = LittleFS.open(bestPath, "r"); uint32_t header[4];
    f.read((uint8_t*)header, sizeof(header));
    for (uint32_t i = 0; i < header[2]; ++i) {
      DiagEventRecord rec; if (f.read((uint8_t*)&rec, sizeof(rec)) != sizeof(rec)) break;
      for (uint16_t j = 0; j < DIAG_RING_CAPACITY; ++j) if (!ring[j].inUse) { ring[j] = rec; ++count; break; }
    }
    f.close();
  }

  void persistCritical() {
    if (millis() - lastPersistMs < 5000) return;
    lastPersistMs = millis();
    DiagEventRecord records[32]; uint32_t n = 0;
    for (uint16_t i = 0; i < DIAG_RING_CAPACITY && n < 32; ++i) {
      taskENTER_CRITICAL(&mux);
      if (ring[i].inUse && ring[i].severity >= DIAG_SEV_ERROR) records[n++] = ring[i];
      taskEXIT_CRITICAL(&mux);
    }
    uint32_t crc = crc32_le(0, (uint8_t*)records, n * sizeof(DiagEventRecord));
    if (persistedOnce && crc == persistedCrc && n == persistedCount) return;
    size_t total = LittleFS.totalBytes(), used = LittleFS.usedBytes();
    if (total <= used || total-used < DIAG_MIN_LITTLEFS_FREE + n*sizeof(DiagEventRecord)) return;
    uint32_t header[4] = {0x46584432, journalGeneration + 1, n, crc};
    File f = LittleFS.open((header[1] & 1) ? "/diag_A.bin" : "/diag_B.bin", "w");
    if (!f) return;
    bool ok = f.write((uint8_t*)header, sizeof(header)) == sizeof(header);
    ok = f.write((uint8_t*)records, n*sizeof(DiagEventRecord)) == n*sizeof(DiagEventRecord) && ok;
    f.flush(); ok = ok && !f.getWriteError(); f.close();
    if (ok) { journalGeneration = header[1]; persistedCrc = crc; persistedCount = n; persistedOnce = true; }
  }

  // Background upload logic (executed on Core 0 httpWorkerTask)
  bool flush(WiFiClientSecure* client, const char* rootCA, const String& baseUrl, const char* apiKey, const String& deviceId) {
    if (WiFi.status() != WL_CONNECTED || !client) return false;

    // Check backoff interval
    unsigned long now = millis();
    if (now - lastFlushAttemptMs < flushBackoffMs) {
      return false;
    }
    lastFlushAttemptMs = now;

    // Snapshot up to 15 unacknowledged events from ring buffer under short spinlock
    const uint8_t BATCH_LIMIT = 15;
    DiagEventRecord batch[BATCH_LIMIT];
    uint8_t batchCount = 0;

    taskENTER_CRITICAL(&mux);
    for (uint16_t idx = 0; idx < DIAG_RING_CAPACITY && batchCount < BATCH_LIMIT; idx++) {
      if (ring[idx].inUse) {
        memcpy(&batch[batchCount], &ring[idx], sizeof(DiagEventRecord));
        batchCount++;
      }
    }
    taskEXIT_CRITICAL(&mux);

    if (batchCount == 0) {
      return true; // Nothing to upload
    }

    // Serialize JSON batch payload
    DynamicJsonDocument doc(8192);
    doc["deviceId"] = deviceId;
    JsonArray eventsArr = doc.createNestedArray("events");

    for (uint8_t i = 0; i < batchCount; i++) {
      JsonObject item = eventsArr.createNestedObject();
      item["eventId"] = batch[i].eventId;
      item["eventCode"] = batch[i].eventCode;

      const char* sevStr = "INFO";
      switch (batch[i].severity) {
        case DIAG_SEV_WARN:     sevStr = "WARN"; break;
        case DIAG_SEV_ERROR:    sevStr = "ERROR"; break;
        case DIAG_SEV_CRITICAL: sevStr = "CRITICAL"; break;
        case DIAG_SEV_FATAL:    sevStr = "FATAL"; break;
        default:                sevStr = "INFO"; break;
      }
      item["severity"] = sevStr;
      item["timestamp"] = batch[i].timestamp;
      item["uptimeMs"] = batch[i].uptimeMs;
      item["param1"] = batch[i].param1;
      item["param2"] = batch[i].param2;
      if (batch[i].detail[0] != '\0') {
        item["detail"] = batch[i].detail;
      }
    }

    JsonObject stats = doc.createNestedObject("diagStats");
    stats["queueDepth"] = getQueueDepth();
    stats["droppedCount"] = getDroppedCount();
    stats["resetReason"] = resetReasonStr;

    String jsonPayload;
    if (doc.overflowed()) return false;
    serializeJson(doc, jsonPayload);

    client->setCACert(rootCA);
    client->setHandshakeTimeout(5);
    client->setTimeout(5);
    HTTPClient http;
    http.begin(*client, baseUrl + "/api/hardware/diagnostics");
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", String("Bearer ") + apiKey);
    http.setConnectTimeout(3000);
    http.setTimeout(7000);

    esp_task_wdt_reset();
    int httpCode = http.POST(jsonPayload);
    esp_task_wdt_reset();

    if (httpCode == 200) {
      String response = boundedHttpResponse(http, 4096);
      http.end();

      DynamicJsonDocument resDoc(4096);
      DeserializationError err = deserializeJson(resDoc, response);
      if (!err && resDoc["success"] == true) {
        JsonArray ackList = resDoc["ackEventIds"].as<JsonArray>();

        // Only acknowledge IDs actually sent in this batch. Each slot copy/change is bounded.
        for (JsonVariant ackIdVar : ackList) {
          const char* ackId = ackIdVar.as<const char*>();
          if (!ackId) continue;
          bool sent = false;
          for (uint8_t i = 0; i < batchCount; ++i) if (!strcmp(batch[i].eventId, ackId)) sent = true;
          if (!sent) continue;
          taskENTER_CRITICAL(&mux);
          for (uint16_t i = 0; i < DIAG_RING_CAPACITY; ++i) {
            if (ring[i].inUse && !strcmp(ring[i].eventId, ackId)) { ring[i].inUse = false; --count; break; }
          }
          taskEXIT_CRITICAL(&mux);
        }

        // Reset backoff on success
        flushBackoffMs = 30000;
        return true;
      }
    } else {
      http.end();
      // Exponential backoff with random jitter on failure: 30s -> 60s -> 120s -> 300s max
      flushBackoffMs = min(flushBackoffMs * 2, 300000UL) + (esp_random() % 3000);
      Serial.printf("[DIAG] Ingest failed (HTTP %d). Backing off for %lums\n", httpCode, flushBackoffMs);
    }

    return false;
  }

};

extern FocusXDiagnostics DiagSubsystem;

#endif
