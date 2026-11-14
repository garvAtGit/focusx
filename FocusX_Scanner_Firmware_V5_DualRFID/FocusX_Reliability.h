#ifndef FOCUSX_RELIABILITY_H
#define FOCUSX_RELIABILITY_H
#include <Arduino.h>
#include <freertos/semphr.h>
#include <esp_heap_caps.h>
#include <HTTPClient.h>

static bool takeFocusXMutex(SemaphoreHandle_t mutex) {
  if (!mutex) return false;
  return (xSemaphoreTakeRecursive(mutex, pdMS_TO_TICKS(10000)) == pdTRUE);
}

// Task mutexes allow scheduling/interrupts while String/vector/flash operations run.
// Lock ordering: snapshot -> journal. Never take a snapshot lock with journal held.
class FocusXLock {
  SemaphoreHandle_t mutex;
  bool locked;
public:
  explicit FocusXLock(SemaphoreHandle_t value) : mutex(value), locked(false) {
    if (mutex) locked = (xSemaphoreTakeRecursive(mutex, pdMS_TO_TICKS(10000)) == pdTRUE);
  }
  ~FocusXLock() { if (locked && mutex) xSemaphoreGiveRecursive(mutex); }
  bool isLocked() const { return locked; }
  FocusXLock(const FocusXLock&) = delete;
  FocusXLock& operator=(const FocusXLock&) = delete;
};

// HTTPClient handles chunk framing. The sink bounds decoded bytes and elapsed time.
class FocusXResponseSink : public Stream {
  String& output;
  size_t limit;
  uint32_t started;
public:
  FocusXResponseSink(String& value, size_t maxBytes) : output(value), limit(maxBytes), started(millis()) {}
  size_t write(uint8_t value) override { return write(&value, 1); }
  size_t write(const uint8_t* data, size_t size) override {
    if (millis()-started > 10000 || output.length()+size > limit) return 0;
    if (!output.concat((const char*)data, size)) return 0;
    return size;
  }
  int available() override { return 0; }
  int read() override { return -1; }
  int peek() override { return -1; }
  void flush() override {}
};

static String boundedHttpResponse(HTTPClient& http, size_t maxBytes) {
  String body;
  if (http.getSize() > (int)maxBytes) return body;
  FocusXResponseSink sink(body, maxBytes);
  if (http.writeToStream(&sink) < 0) body = "";
  return body;
}

struct FocusXCheckpoint {
  uint32_t magic;
  uint32_t operation;
  uint32_t uptimeMs;
  uint32_t freeHeap;
  uint32_t largestBlock;
};
RTC_NOINIT_ATTR static FocusXCheckpoint previousWorkerCheckpoint;
static void workerCheckpoint(uint32_t operation) {
  previousWorkerCheckpoint.magic = 0;
  previousWorkerCheckpoint.operation = operation;
  previousWorkerCheckpoint.uptimeMs = millis();
  previousWorkerCheckpoint.freeHeap = heap_caps_get_free_size(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
  previousWorkerCheckpoint.largestBlock = heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
  previousWorkerCheckpoint.magic = 0x46584350;
}
#endif
