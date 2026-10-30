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

#define DIAG_DETAIL_MAX_LEN 28
#define DIAG_EVENT_ID_LEN 32
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

public:
  FocusXDiagnostics() : head(0), tail(0), count(0), droppedCount(0), sequenceId(0),
                        lastFlushAttemptMs(0), flushBackoffMs(30000) {
    vPortCPUInitializeMutex(&mux);
    memset(ring, 0, sizeof(ring));
    strncpy(resetReasonStr, "UNKNOWN", sizeof(resetReasonStr));
    memset(devicePrefix, 0, sizeof(devicePrefix));
  }

  void init(const char* devId) {
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
    capture(DIAG_CODE_RESET_REASON, DIAG_SEV_INFO, (int32_t)reason, ESP.getFreeHeap(), resetReasonStr);
  }

  const char* getResetReason() const { return resetReasonStr; }
  uint16_t getQueueDepth() const { return count; }
  uint32_t getDroppedCount() const { return droppedCount; }

  // Non-blocking capture path (< 2 microseconds, zero heap allocation)
  bool capture(DiagEventCode code, DiagSeverity sev, int32_t p1 = 0, uint32_t p2 = 0, const char* detail = nullptr) {
    taskENTER_CRITICAL(&mux);

    // Eviction policy if ring is full
    if (count >= DIAG_RING_CAPACITY) {
      if (sev < DIAG_SEV_ERROR) {
        // Discard INFO / WARN if full to preserve room for ERROR / CRITICAL / FATAL
        droppedCount++;
        taskEXIT_CRITICAL(&mux);
        return false;
      }

      // If new event is ERROR or higher, find oldest entry with lower severity to replace
      int replaceIdx = -1;
      for (uint16_t i = 0; i < count; i++) {
        uint16_t idx = (tail + i) % DIAG_RING_CAPACITY;
        if (ring[idx].inUse && ring[idx].severity < sev) {
          replaceIdx = idx;
          break;
        }
      }

      if (replaceIdx >= 0) {
        head = replaceIdx; // overwrite lower-severity slot
      } else {
        // All items have same or higher severity, drop oldest entry
        ring[tail].inUse = false;
        tail = (tail + 1) % DIAG_RING_CAPACITY;
        count--;
        droppedCount++;
      }
    }

    DiagEventRecord& rec = ring[head];
    sequenceId++;
    uint32_t nowEpoch = (uint32_t)time(nullptr);
    rec.timestamp = (nowEpoch > 1700000000) ? nowEpoch : 0;
    rec.uptimeMs = millis();
    rec.eventCode = (uint16_t)code;
    rec.severity = (uint8_t)sev;
    rec.param1 = p1;
    rec.param2 = p2;
    rec.inUse = true;

    snprintf(rec.eventId, sizeof(rec.eventId), "d_%lx_%x", (unsigned long)rec.uptimeMs, (unsigned int)(sequenceId & 0xFFFF));

    if (detail && detail[0] != '\0') {
      strncpy(rec.detail, detail, sizeof(rec.detail) - 1);
      rec.detail[sizeof(rec.detail) - 1] = '\0';
    } else {
      rec.detail[0] = '\0';
    }

    head = (head + 1) % DIAG_RING_CAPACITY;
    if (count < DIAG_RING_CAPACITY) {
      count++;
    }

    taskEXIT_CRITICAL(&mux);

    // If critical or fatal, persist to isolated flash journal (non-blocking, guarded against low flash)
    if (sev >= DIAG_SEV_CRITICAL) {
      persistCriticalToFlash(rec);
    }

    return true;
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
    for (uint16_t i = 0; i < count && batchCount < BATCH_LIMIT; i++) {
      uint16_t idx = (tail + i) % DIAG_RING_CAPACITY;
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
    DynamicJsonDocument doc(2048);
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
      item["timestamp"] = batch[i].timestamp > 0 ? batch[i].timestamp : (uint32_t)(time(nullptr));
      item["uptimeMs"] = batch[i].uptimeMs;
      item["param1"] = batch[i].param1;
      item["param2"] = batch[i].param2;
      if (batch[i].detail[0] != '\0') {
        item["detail"] = batch[i].detail;
      }
    }

    JsonObject stats = doc.createNestedObject("diagStats");
    stats["queueDepth"] = count;
    stats["droppedCount"] = droppedCount;
    stats["resetReason"] = resetReasonStr;

    String jsonPayload;
    serializeJson(doc, jsonPayload);

    client->setCACert(rootCA);
    HTTPClient http;
    http.begin(*client, baseUrl + "/api/hardware/diagnostics");
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", String("Bearer ") + apiKey);
    http.setTimeout(7000);

    esp_task_wdt_reset();
    int httpCode = http.POST(jsonPayload);
    esp_task_wdt_reset();

    if (httpCode == 200) {
      String response = http.getString();
      http.end();

      DynamicJsonDocument resDoc(1024);
      DeserializationError err = deserializeJson(resDoc, response);
      if (!err && resDoc["success"] == true) {
        JsonArray ackList = resDoc["ackEventIds"].as<JsonArray>();

        // Reclaim acknowledged events from ring buffer
        taskENTER_CRITICAL(&mux);
        for (JsonVariant ackIdVar : ackList) {
          const char* ackId = ackIdVar.as<const char*>();
          if (!ackId) continue;

          for (uint16_t i = 0; i < count; i++) {
            uint16_t idx = (tail + i) % DIAG_RING_CAPACITY;
            if (ring[idx].inUse && strcmp(ring[idx].eventId, ackId) == 0) {
              ring[idx].inUse = false;
              break;
            }
          }
        }

        // Advance tail past contiguous cleared entries
        while (count > 0 && !ring[tail].inUse) {
          tail = (tail + 1) % DIAG_RING_CAPACITY;
          count--;
        }
        taskEXIT_CRITICAL(&mux);

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

private:
  void persistCriticalToFlash(const DiagEventRecord& rec) {
    // Strictly protect attendance fail-closed margin: never write if free LittleFS < 30,000 bytes
    size_t total = LittleFS.totalBytes();
    size_t used = LittleFS.usedBytes();
    if (total <= used || (total - used) < DIAG_MIN_LITTLEFS_FREE) {
      return; // Do not risk filling attendance journal space
    }

    // Check size cap of /diag_critical.bin
    if (LittleFS.exists(DIAG_FLASH_JOURNAL_PATH)) {
      File checkF = LittleFS.open(DIAG_FLASH_JOURNAL_PATH, "r");
      if (checkF) {
        size_t sz = checkF.size();
        checkF.close();
        if (sz >= DIAG_FLASH_MAX_BYTES) {
          // Truncate/reset critical journal if capped to avoid unbounded growth
          LittleFS.remove(DIAG_FLASH_JOURNAL_PATH);
        }
      }
    }

    File f = LittleFS.open(DIAG_FLASH_JOURNAL_PATH, "a");
    if (!f) return;

    // Write binary record with CRC32
    uint32_t crc = crc32_le(0, (const uint8_t*)&rec, sizeof(DiagEventRecord));
    f.write((const uint8_t*)&crc, sizeof(uint32_t));
    f.write((const uint8_t*)&rec, sizeof(DiagEventRecord));
    f.flush();
    f.close();
  }
};

extern FocusXDiagnostics DiagSubsystem;

#endif // FOCUSX_DIAGNOSTICS_H
