#line 1 "C:\\Users\\thees\\Compound\\Desktop\\01_Active Projects\\Library Near\\dashboard\\FocusX_Scanner_Firmware_V5_DualRFID\\FocusX_CrashUpload.h"
#ifndef FOCUSX_CRASH_UPLOAD_H
#define FOCUSX_CRASH_UPLOAD_H
#include <esp_core_dump.h>
#include <esp_partition.h>
#include <esp_ota_ops.h>
#include <mbedtls/sha256.h>

// Keep the original dump in flash. Re-upload after interruption is idempotent.
// Only enqueue another batch once every previous diagnostic has been acknowledged.
class FocusXCrashUpload {
  const esp_partition_t* partition = nullptr;
  size_t size = 0, offset = 0;
  char prefix[52] = {};
  bool metadataSent = false, completed = false;
public:
  void begin() {
    size_t address = 0;
    partition = esp_partition_find_first(ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_DATA_COREDUMP, nullptr);
    if (!partition || esp_core_dump_image_get(&address, &size) != ESP_OK || !size || size > partition->size) { partition = nullptr; return; }
    // SDK reports the physical image address; reject a layout mismatch.
    if (address != partition->address) { partition = nullptr; return; }
    mbedtls_sha256_context ctx; mbedtls_sha256_init(&ctx); mbedtls_sha256_starts(&ctx, 0);
    uint8_t buffer[256], digest[32];
    for (size_t pos = 0; pos < size; pos += sizeof(buffer)) {
      size_t n = min(sizeof(buffer), size-pos);
      if (esp_partition_read(partition, pos, buffer, n) != ESP_OK) { partition = nullptr; break; }
      mbedtls_sha256_update(&ctx, buffer, n);
      delay(1);
    }
    mbedtls_sha256_finish(&ctx, digest); mbedtls_sha256_free(&ctx);
    if (!partition) return;
    char hash[33]; for (int i = 0; i < 16; ++i) snprintf(hash+i*2, 3, "%02x", digest[i]);
    snprintf(prefix, sizeof(prefix), "cd_%012llx_%s", ESP.getEfuseMac(), hash);
  }

  void pump(FocusXDiagnostics& diagnostics, Preferences& prefs) {
    if (!partition || completed || diagnostics.getQueueDepth() != 0) return;
    if (prefs.getString("uploadedCore", "") == prefix) { completed = true; return; }
    if (!metadataSent) {
      DiagEventRecord record = {};
      snprintf(record.eventId, sizeof(record.eventId), "%s_meta", prefix);
      record.eventCode = 1011; record.severity = DIAG_SEV_WARN; record.param2 = size;
      const esp_app_desc_t* app = esp_ota_get_app_description();
      for (int i = 0; i < 32; ++i) snprintf(record.detail+i*2, 3, "%02x", app->app_elf_sha256[i]);
      // This is the uploader ELF; the dump itself identifies the crashed image.
      if (!diagnostics.enqueueExternal(record)) return;
      metadataSent = true;
      return;
    }
    if (offset == size) { prefs.putString("uploadedCore", prefix); completed = true; return; }
    for (int i = 0; i < 10 && offset < size; ++i) {
      uint8_t data[96]; size_t n = min(sizeof(data), size-offset);
      if (esp_partition_read(partition, offset, data, n) != ESP_OK) return;
      DiagEventRecord record = {};
      snprintf(record.eventId, sizeof(record.eventId), "%s_%08lx", prefix, (unsigned long)offset);
      record.eventCode = 1010; record.severity = DIAG_SEV_INFO;
      record.param1 = offset; record.param2 = size;
      for (size_t j = 0; j < n; ++j) snprintf(record.detail+j*2, 3, "%02x", data[j]);
      if (!diagnostics.enqueueExternal(record)) return;
      offset += n;
    }
  }
};
#endif
