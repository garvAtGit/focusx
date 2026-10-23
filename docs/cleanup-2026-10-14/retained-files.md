# Retained and deferred files - second cleanup pass

The original first-pass manifest is preserved as historical evidence. The new [second-pass manifest](second-pass-manifest.csv) records current decisions. KEEP/PRESERVE mean retained, not runtime-tested. DEFER identifies incomplete removal evidence or unavailable validation.

## PRESERVE (38 exact candidate entries)

| Path | Category | Reason |
|---|---|---|
| `FocusX_Scanner_Firmware_V5_DualRFID/FocusX_Scanner_Firmware_V5_DualRFID.ino` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `FocusX_Scanner_Firmware_V5_DualRFID/FocusX_Scanner_Firmware_V5_DualRFID.ino.backup` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `ble_only_logic/HardwareController.cpp` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `ble_only_logic/HardwareController.h` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `ble_only_logic/LogManager.cpp` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `ble_only_logic/LogManager.h` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `ble_only_logic/SecurityManager.cpp` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `ble_only_logic/SecurityManager.h` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `ble_only_logic/ble_only_logic.ino` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `ble_only_logic/config.h` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `esp32_qr_access_changed/HardwareController.cpp` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `esp32_qr_access_changed/HardwareController.h` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `esp32_qr_access_changed/LogManager.cpp` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `esp32_qr_access_changed/LogManager.h` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `esp32_qr_access_changed/README.md` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `esp32_qr_access_changed/SecurityManager.cpp` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `esp32_qr_access_changed/SecurityManager.h` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `esp32_qr_access_changed/config.h` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `esp32_qr_access_changed/esp32_qr_access_changed.ino` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `nodemcu_qr_access/HardwareController.cpp` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `nodemcu_qr_access/HardwareController.h` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `nodemcu_qr_access/LogManager.cpp` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `nodemcu_qr_access/LogManager.h` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `nodemcu_qr_access/Node_MCU_testing.ino` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `nodemcu_qr_access/SecurityManager.cpp` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `nodemcu_qr_access/SecurityManager.h` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `nodemcu_qr_access/WiFiConfigManager.cpp` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `nodemcu_qr_access/WiFiConfigManager.h` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `nodemcu_qr_access/config.example.h` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `nodemcu_qr_access/nodemcu_qr_access.ino` | protected-firmware | Entire directory explicitly protected by user; including internal backups, headers, examples and configuration. |
| `rfid_only_logic/HardwareController.cpp` | offline-rfid-module | Standalone NVS authorization and persistent LittleFS offline logs are absent from V5; distinct RFID integration/diagnostic value. |
| `rfid_only_logic/HardwareController.h` | offline-rfid-module | Standalone NVS authorization and persistent LittleFS offline logs are absent from V5; distinct RFID integration/diagnostic value. |
| `rfid_only_logic/LogManager.cpp` | offline-rfid-module | Standalone NVS authorization and persistent LittleFS offline logs are absent from V5; distinct RFID integration/diagnostic value. |
| `rfid_only_logic/LogManager.h` | offline-rfid-module | Standalone NVS authorization and persistent LittleFS offline logs are absent from V5; distinct RFID integration/diagnostic value. |
| `rfid_only_logic/SecurityManager.cpp` | offline-rfid-module | Standalone NVS authorization and persistent LittleFS offline logs are absent from V5; distinct RFID integration/diagnostic value. |
| `rfid_only_logic/SecurityManager.h` | offline-rfid-module | Standalone NVS authorization and persistent LittleFS offline logs are absent from V5; distinct RFID integration/diagnostic value. |
| `rfid_only_logic/config.h` | offline-rfid-module | Standalone NVS authorization and persistent LittleFS offline logs are absent from V5; distinct RFID integration/diagnostic value. |
| `rfid_only_logic/rfid_only_logic.ino` | offline-rfid-module | Standalone NVS authorization and persistent LittleFS offline logs are absent from V5; distinct RFID integration/diagnostic value. |

## KEEP (52 exact candidate entries)

| Path | Category | Reason |
|---|---|---|
| `Test.java` | beacon-diagnostic | Signed-byte UUID/iBeacon interop reproductions relate to still-supported V5 BLE and external mobile behavior; no equivalent regression fixture proven. |
| `assign_kripa.mjs` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `backfill.ts` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `check_db.py` | python-diagnostic | Standalone serial/device/database diagnosis or DB patch/revert utility; operational relevance distinct from source patching. |
| `check_db2.js` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `cleanup.ts` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `clear-sunny.ts` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `delete_duplicates.ts` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `dump_key.py` | python-diagnostic | Standalone serial/device/database diagnosis or DB patch/revert utility; operational relevance distinct from source patching. |
| `fast_xyz.js` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `fix-phones.ts` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `fix_final.js` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `fix_final2.js` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `fix_lib.js` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `fix_phones.ts` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `fix_plan.js` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `fix_raw.js` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `fix_relay.ts` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `fix_relay_ids.js` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `fix_sub.js` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `fix_time.js` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `insert_claim.js` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `insert_claim_pg.js` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `make_admin.ts` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `make_admin2.ts` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `notify_all.ts` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `onboard-kripa-seats.ts` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `overview.png` | architecture-image | Unique architectural documentation assets; no maintained equivalent proven; no move needed for this pass. |
| `overview_asymmetric.png` | architecture-image | Unique architectural documentation assets; no maintained equivalent proven; no move needed for this pass. |
| `patch_db.py` | python-diagnostic | Standalone serial/device/database diagnosis or DB patch/revert utility; operational relevance distinct from source patching. |
| `query_admins.ts` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `query_relays.js` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `query_schema.js` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `read_crash.py` | python-diagnostic | Standalone serial/device/database diagnosis or DB patch/revert utility; operational relevance distinct from source patching. |
| `read_serial.py` | python-diagnostic | Standalone serial/device/database diagnosis or DB patch/revert utility; operational relevance distinct from source patching. |
| `read_serial_120.py` | python-diagnostic | Standalone serial/device/database diagnosis or DB patch/revert utility; operational relevance distinct from source patching. |
| `recover_booking.ts` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `resend_notification.ts` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `resend_notifs.ts` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `reset_kyc.ts` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `revert_db.py` | python-diagnostic | Standalone serial/device/database diagnosis or DB patch/revert utility; operational relevance distinct from source patching. |
| `scratch-seed.js` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `seed.ts` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `send_pwa_notif.ts` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `simulate_java.js` | beacon-diagnostic | Signed-byte UUID/iBeacon interop reproductions relate to still-supported V5 BLE and external mobile behavior; no equivalent regression fixture proven. |
| `test.kt` | beacon-diagnostic | Signed-byte UUID/iBeacon interop reproductions relate to still-supported V5 BLE and external mobile behavior; no equivalent regression fixture proven. |
| `test_cf.ts` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `test_db.ts` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `update-shanti-seats.ts` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `update_db.ts` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `update_relay.ts` | utility | Operational utility retained; no proof that data repair/provisioning/redelivery task is completed. |
| `dependency:@yudiel/react-qr-scanner` | dependency | Imported by supported dashboard/scanner/ScannerClient.tsx; browser QR remains supported. |

## DEFER (16 exact candidate entries)

| Path | Category | Reason |
|---|---|---|
| `prisma/schema-old.prisma` | schema-snapshot | Historical schema differences may assist migrations/data recovery; no isolated database/schema validation; active Prisma schema/config unchanged. |
| `prisma_dump.prisma` | schema-snapshot | Historical schema differences may assist migrations/data recovery; no isolated database/schema validation; active Prisma schema/config unchanged. |
| `src/app/_prototype-pass/page.tsx` | source-candidate | Application/prototype review completed; no installed Next guides, TypeScript/build runner or browser regression environment. Public prototype pages are automatic routes; private design artifact/future reusable components lack sufficient validated retirement evidence. |
| `src/app/actions/query-actions.ts` | source-candidate | Application/prototype review completed; no installed Next guides, TypeScript/build runner or browser regression environment. Public prototype pages are automatic routes; private design artifact/future reusable components lack sufficient validated retirement evidence. |
| `src/app/prototype/calendar/CalendarPrototype.tsx` | source-candidate | Application/prototype review completed; no installed Next guides, TypeScript/build runner or browser regression environment. Public prototype pages are automatic routes; private design artifact/future reusable components lack sufficient validated retirement evidence. |
| `src/app/prototype/calendar/page.tsx` | source-candidate | Application/prototype review completed; no installed Next guides, TypeScript/build runner or browser regression environment. Public prototype pages are automatic routes; private design artifact/future reusable components lack sufficient validated retirement evidence. |
| `src/app/prototype/dashboard/ClientDashboard.tsx` | source-candidate | Application/prototype review completed; no installed Next guides, TypeScript/build runner or browser regression environment. Public prototype pages are automatic routes; private design artifact/future reusable components lack sufficient validated retirement evidence. |
| `src/app/prototype/dashboard/page.tsx` | source-candidate | Application/prototype review completed; no installed Next guides, TypeScript/build runner or browser regression environment. Public prototype pages are automatic routes; private design artifact/future reusable components lack sufficient validated retirement evidence. |
| `src/app/prototype/winter-arc/page.tsx` | source-candidate | Application/prototype review completed; no installed Next guides, TypeScript/build runner or browser regression environment. Public prototype pages are automatic routes; private design artifact/future reusable components lack sufficient validated retirement evidence. |
| `src/components/InteractivePhoneMockup.tsx` | source-candidate | Application/prototype review completed; no installed Next guides, TypeScript/build runner or browser regression environment. Public prototype pages are automatic routes; private design artifact/future reusable components lack sufficient validated retirement evidence. |
| `src/components/LiveEntryLogs.tsx` | source-candidate | Application/prototype review completed; no installed Next guides, TypeScript/build runner or browser regression environment. Public prototype pages are automatic routes; private design artifact/future reusable components lack sufficient validated retirement evidence. |
| `src/components/ServiceWorkerRegister.tsx` | source-candidate | Application/prototype review completed; no installed Next guides, TypeScript/build runner or browser regression environment. Public prototype pages are automatic routes; private design artifact/future reusable components lack sufficient validated retirement evidence. |
| `src/components/StudentsInsideWidget.tsx` | source-candidate | Application/prototype review completed; no installed Next guides, TypeScript/build runner or browser regression environment. Public prototype pages are automatic routes; private design artifact/future reusable components lack sufficient validated retirement evidence. |
| `src/components/home/how-it-works.tsx` | source-candidate | Application/prototype review completed; no installed Next guides, TypeScript/build runner or browser regression environment. Public prototype pages are automatic routes; private design artifact/future reusable components lack sufficient validated retirement evidence. |
| `dependency:html5-qrcode` | dependency | No active source import found; missing dependencies prevents safe installation/lockfile/compile verification. |
| `dependency:styled-components` | dependency | No active source import found; missing dependencies prevents safe installation/lockfile/compile verification. |

## Preserved core and user work

All supported pages/layouts, every API endpoint and server-action file, middleware, booking/attendance/refund/realtime/authentication implementations, Prisma schema/migrations/seed, tests, public assets, Sanity, package files and compiler/framework/cron configuration remain unchanged. The only `src/` deletion is the standalone unimported `src/test_ws.mjs` fixed-identity development probe. The six UI prototype files and five reported unreferenced components remain; public prototype routes are not treated as unused merely because they have no imports.

All 14 pre-existing untracked audit/PRD files and all three first-pass cleanup artifacts are unchanged. No utility was moved; relative tool paths remain intact. Retained operational tools were not executed against external systems. Their runtime correctness remains unverified; syntax checking alone does not establish database/tool functionality.
