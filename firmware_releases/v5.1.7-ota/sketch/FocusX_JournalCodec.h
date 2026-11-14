#line 1 "C:\\Users\\thees\\Compound\\Desktop\\01_Active Projects\\Library Near\\dashboard\\FocusX_Scanner_Firmware_V5_DualRFID\\FocusX_JournalCodec.h"
#ifndef FOCUSX_JOURNAL_CODEC_H
#define FOCUSX_JOURNAL_CODEC_H
#include <stdint.h>
#include <stddef.h>
#include <string.h>

static uint32_t focusxJournalChecksum(const char* data, size_t length, bool version2) {
  uint32_t crc = version2 ? 0xffffffffU : 0;
  for (size_t i = 0; i < length; ++i) {
    if (!version2) { crc += (uint8_t)data[i]; continue; }
    crc ^= (uint8_t)data[i];
    for (int bit = 0; bit < 8; ++bit) crc = (crc >> 1) ^ (0xedb88320U & (0U - (crc & 1U)));
  }
  return version2 ? crc ^ 0xffffffffU : crc;
}

// Validates a bounded complete line without allocating; callers must require its newline.
static bool focusxJournalRecordValid(const char* line, size_t length) {
  if (!line || length < 8 || length > 512) return false;
  bool v2 = !strncmp(line, "ADD2 ", 5) || !strncmp(line, "ACK2 ", 5);
  if (!v2) return false;
  size_t split = length;
  while (split > 5 && line[split-1] != ' ') --split;
  if (split <= 5 || split == length) return false;
  uint64_t expected = 0;
  for (size_t i = split; i < length; ++i) {
    if (line[i] < '0' || line[i] > '9') return false;
    expected = expected*10 + (line[i]-'0');
    if (expected > 0xffffffffULL) return false;
  }
  return focusxJournalChecksum(line+5, split-6, true) == expected;
}
#endif
