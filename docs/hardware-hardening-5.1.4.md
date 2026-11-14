# Firmware 5.1.4 hardening and validation

This is an incremental hardening release for the existing Arduino-ESP32 firmware. It does not establish the cause of the historical failures or replace field validation.

## Implemented behavior

- Correct ESP-IDF reset labels and minimum severities on ingestion and historical reads. Unknown reset reasons stay unknown; no promise of preserved attendance is inferred from a boot event.
- Device-scoped diagnostic storage identities, randomized per-boot firmware IDs, committed ACKs, bounded request validation and rejection reporting. Only newly inserted critical records produce a realtime broadcast.
- Snapshot parsing from flash uses bounded lines and canonical signature verification. Separate installation and access mutexes keep candidate I/O outside the active-snapshot lock. A complete candidate becomes active by vector swap. A single NVS commit marker identifies slot, library, and revision; boot recovery filters library scope.
- Attendance queue operations use task mutexes, preserving interrupt scheduling. The in-memory queue is capped at 64; additional records remain on flash.
- Attendance append and ACK operations are serialized with replay. New ADD2 and ACK2 records have CRC32. Full writes are checked. Incomplete trailing lines are ignored; future appends insert a separator. Existing ADD/ACK records remain readable. Invalid records prevent automatic journal deletion and produce an error diagnostic.
- Remote unlocks are queued to the access task. Journal commit precedes gate state changes. Durable remote commands report QUEUED, then SUCCESS/FAILED after execution; reboot during queueing reports uncertain completion as failure. No automatic replay of that command is performed by the firmware.
- TLS verification replaces the insecure ping path. Scoped client objects remove repeated client-object new/delete, while TLS internals still allocate. Cryptographic context setup failures fail closed. Connect/handshake/read limits and bounded response sinks constrain network work. OTA/snapshot commands close the heartbeat TLS connection before opening another one.
- RTC worker checkpoints and internal heap measurements help diagnose the next failure. SDK panic output remains enabled.
- Fixed-size diagnostic slots prevent ring-index corruption. Capture never writes flash. A worker-side A/B CRC journal retains up to 32 error/critical records, with a five-second persistence interval and a reserved attendance storage margin.
- Core dumps are read from a separate 256 KB flash partition. Deterministic, retryable diagnostic chunks upload in the background. A session-authenticated administrator can retrieve the latest complete dump from `/api/hardware/diagnostics/crash?relayId=...`. The server verifies contiguous offsets and the SHA-256 prefix before returning bytes. Incomplete uploads return 409; absent dumps return 404. Raw chunks are excluded from the normal audit feed.

## Build

Run `./scripts/build-hardened-firmware.ps1 -BuildPath <absolute-output-directory>` from PowerShell. The default build target is ESP32-S3 with 8 MB flash and OPI PSRAM; confirm it matches the physical board before installation. The script pins Arduino-ESP32 2.0.17 and emits hashes for the binary, ELF, bootloader and partition artifacts. Retain each release ELF permanently for crash decoding.

Libraries used during validation: NimBLE-Arduino 2.5.1, Adafruit PN532 1.3.4, Adafruit BusIO 1.17.4, Adafruit NeoPixel 1.15.5, WiFiManager 2.0.17, ArduinoJson 7.4.3, PubSubClient 2.8, LiquidCrystal I2C 1.1.2. The LCD library emits an architecture compatibility warning and needs physical validation.

The added coredump partition starts at 0x710000 and ends at 0x750000. Existing app, filesystem, NVS and OTA-data offsets are preserved. An application-only OTA does not update the partition table: existing devices require a separately verified partition-table installation before flash dumps work. Inspect the installed layout and back up device state first. Do not erase the filesystem or NVS as part of this release.

Core-dump transfer deliberately uses the existing authenticated ingestion path and can take hours at its normal 30-second diagnostic cadence. A newer crash can replace the device's single dump before transfer completes. Uploader metadata contains the uploader ELF hash; identify the crashed ELF from the dump itself. Dumps contain sensitive memory; restrict database access and retention accordingly. Chunks remain out of the normal diagnostics GET response.

## Automated checks

```
npx tsc --noEmit --pretty false
npx tsx --test tests/hardware-diagnostics.test.ts tests/hardware-diagnostics-route.test.ts
g++ -std=c++17 -Wall -Wextra -Werror tests/firmware-journal.test.cpp -o <output-executable>
<output-executable>
```

The native test exercises the same record validator/checksum code used by firmware, including every truncation and single-byte mutation of 2,000 records. Route tests execute the production POST handler with an isolated database substitute; they do not validate PostgreSQL deployment or transactions against a live database.

## Required device acceptance before rollout

1. Compare installed firmware, board, partitions and library versions. Capture serial panic output and retain the exact ELF for the tested build.
2. Scan both readers continuously during signed snapshot updates, including changed record counts, invalid signatures, oversized lines, revision rollback and library reassignment. Verify decisions always use a complete snapshot and the correct device secret.
3. Disconnect Wi-Fi; stall DNS, TLS, responses and the server; return 401, 429 and 5xx. Check task deadlines, queue bounds and local scan latency. Confirm watchdogs remain enabled.
4. Cut power during ADD2 writes, ACK2 writes, snapshot writes/activation, and each diagnostic A/B slot write. Reboot, inspect errors and reconcile committed records at the server. Inject short writes and full storage; the gate must not open for an uncommitted access intent.
5. Test local and remote unlocks together, full access queues, reboot between queueing/commit/actuation/command ACK, and repeated command deliveries. Confirm safe relay state during reset and existing emergency egress.
6. Trigger a controlled panic on a bench unit, reboot, complete dump upload and download it with an administrator session. Decode using the matching ELF. Verify a device API key cannot download it.
7. Test OTA download interruption and rollback on the actual bootloader. Run a seven-day bench soak and a monitored pilot before wider rollout. Track unexplained resets, scan latency, journal integrity, queue age, heap margins and stack margins.

## Remaining architectural work

This release retains String/vector attendance records behind task mutexes and serialized synchronous flash commits. A dedicated storage task, completely fixed-size attendance queues, asynchronous RFID state machines, per-device credential provisioning, durable alert delivery, and independent gate-control hardware remain separate migrations. Access policy, anti-passback grace periods and physical passage detection are unchanged. Memory samples and a compiled binary do not prove the historical crash mechanism is resolved.
