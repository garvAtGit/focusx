#include "../FocusX_Scanner_Firmware_V5_DualRFID/FocusX_JournalCodec.h"
#include <cassert>
#include <string>
#include <iostream>

int main() {
  assert(focusxJournalChecksum("123456789", 9, true) == 0xcbf43926U);
  assert(focusxJournalChecksum("ABC", 3, false) == 198);
  for (const std::string kind : {"ADD2 ", "ACK2 "}) {
    for (unsigned i = 0; i < 1000; ++i) {
      std::string content = "reader-boot-" + std::to_string(i);
      std::string record = kind + content + " " + std::to_string(focusxJournalChecksum(content.data(), content.size(), true));
      assert(focusxJournalRecordValid(record.data(), record.size()));
      for (size_t cut = 0; cut < record.size(); ++cut) {
        assert(!focusxJournalRecordValid(record.data(), cut));
      }
      for (size_t pos = 5; pos < record.size(); ++pos) {
        std::string damaged = record; damaged[pos] ^= 1;
        assert(!focusxJournalRecordValid(damaged.data(), damaged.size()));
      }
    }
  }
  std::cout << "Journal CRC, 2000 records, all truncations and single-byte mutations passed\n";
}
