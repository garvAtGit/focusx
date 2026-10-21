# FOCUSDESK complete repository cleanup - second pass

**CLEANUP COMPLETED - VALIDATION PARTIAL.** Retired source patching workflows, unsupported firmware generations and historical debugging artifacts were removed. Supported application source and explicitly protected firmware remain intact. Remaining source/dependency candidates are documented as deferred; provider rotation and controlled remediation of retained credentials remain separate work. All changes are unstaged and uncommitted.

## 1. Baseline and continuation

Original branch: `master`; current branch: `chore/focusdesk-safe-repository-cleanup`. Recovery/unchanged HEAD: `90c4b5a1700d3f5308086aa1f42f8f9dff5289ee`. Original inventory: 875 non-Git files, 302 root files, 861 tracked entries and 14 pre-existing untracked audit/PRD files. The continuation started with 873 non-Git files, including the three first-pass reports and five prior deletions.

The first-pass `report.md`, `candidate-manifest.csv` and `baseline.json` are immutable historical evidence. Their conservative retention decisions have been reassessed under the new user-authorized retirement policy. All original untracked audit/PRD files remain byte-for-byte unchanged. No resets, stashes, broad cleans, force restores, commits or pushes were used.

Versions declared by current package.json: Next 16.2.7, React 19.2.4, Prisma ^7.8.0 / client ^7.10.0. Node 22.20.0 and npm 11.2.0 are available. node_modules and Arduino tooling are absent. AGENTS.md/CLAUDE.md, both prior manifests/baselines, PRD/audit/architecture references and current package/deployment/Prisma/compiler/test entry points were read. No dependencies were installed.

## 2. Category review and actual removals

| Disjoint second-pass category | Files removed |
|---|---:|
| credential-artifact | 2 |
| debug-artifact | 15 |
| development-probe | 1 |
| firmware-snapshot | 3 |
| obsolete-utility | 37 |
| python-patcher | 163 |
| retired-firmware | 13 |
| source-transformer | 3 |
| superseded-utility | 3 |

The exact [removed-files manifest](removed-files.csv) contains every first- and second-pass deletion, original size/SHA-256, evidence, source commit, recovery command and validation scope. The [second-pass candidate manifest](second-pass-manifest.csv) was written before removal and covers 346 unique entries (343 filesystem paths plus three dependencies). The original candidate manifest was not overwritten.

- Python: every one of 171 root Python files was parsed/inspected for imports, AST calls, target files, entry point, payload features and callers. 163 retired source patch/readback/extraction tools plus one old JSON package snapshot were removed. Seven actual serial/REST/device/database utilities remain. None was run. Retired intermediate source transformations need not match V5 exactly under the new user policy; canonical V5/offline implementations remain unchanged.
- Firmware: five directories retired, covering V1-V4 and original ESP32 QR hardware. V5, three required historical modules and the RFID offline experiment are unchanged. Root empty/current sketches and Oct3 ZIP retired with known Git recovery.
- Logs/dumps: 15 historical compiler/CLI/agent/diff/snippet artifacts removed; two standalone credential exports removed. No unresolved production incident evidence was identified, and all originals remain recoverable in Git.
- Root utilities: 43 old probes, completed source-transformers or superseded wrappers removed. Operational DB/admin/seat/notification/recovery tools remain; no claims of completed production repairs were invented. Retained diagnostic replacements include scripts/check-logs.ts, scripts/query-logs.ts, scripts/query-entry.ts, query_relays.js, query_schema.js and test_db.ts.
- Source/prototypes: only standalone `src/test_ws.mjs` fixed-identity development probe removed. Prototype routes, reusable components and empty server-action module deferred because installed framework/TS/browser regression validation is unavailable. Supported routes/APIs unchanged.
- Dependencies: browser scanner package retained because it is imported; unused-looking html5-qrcode/styled-components deferred pending safe dependency/lockfile validation. Package files unchanged.

## 3. Moves and configuration/document changes

No tools or application files were moved. Current architecture documentation now names active V5 and links the retirement record; historical audits, original first-pass documentation and PRD files were not rewritten.

| Changed path | Purpose | Before SHA-256 | After SHA-256 |
|---|---|---|---|
| `.gitignore` | Strip 37 NUL bytes, preserve meaningful rules, add secret/generated-output ignores and consistent line endings. | 45e26f683cdc48cd624987722b7e1589db31a8b5288dea97724c64d16c2ced40 | 26b871b8b5cfc40ca650aed32d550015872d8b5de37c42c21d2f8330099c832e |
| `.vercelignore` | Exclude local credential exports, retained literal-access tools and firmware from web deployment. | 9064a51bb977998ebc39526e7a4f3a06c5f90b57236bbd5e5b380f324a5c866b | 9473dfdce8ea7542d3cc8b089431d3f002880d5369a32c200832b29ecebc4102 |
| `docs/architecture/07-uncertainties.md` | Correct current hardware/toolchain reference and point to retirement record. | b77a30c69d70d13cc8a9c45aec45396377798ce4e5de4225314ed52d6e51fc3f | e1c231853a93d55aaa2465c6b4a87fa905abaf067e9109ab268e811a275da338 |
| `docs/architecture/README.md` | Replace obsolete original-QR evidence reference with active V5 and retirement record. | 155fa219e12723386ae1ee4f6b604594b6f9623d909846ed4658c729efb53a87 | e342afe73bd8574a5f2fa7959681d9d5e9fbd047d57eb1d53316a7a116c909ba |

TypeScript, Next config, package/lockfile, Vercel crons, Prisma config/schema/migrations and runtime business settings are unchanged. Root operational TypeScript compilation concerns remain for a separately validated configuration change. Ignore patterns do not untrack existing files or erase history.

## 4. Retained files and firmware

See [retained files](retained-files.md) for every retained/deferred candidate and rationale, and [firmware retirement](firmware-retirement.md) for the source comparison, protected modules and recovery details. DEFER: 12 application/prototype/component files, two schema snapshots and two dependencies. No untracked or modified user file was deleted.

## 5. Security

Cashfree standalone credentials, an unreferenced Firebase private-key export and obsolete password-bearing DB probes were removed from the checkout. This does not erase exposure. Ten retained DB repair scripts still contain database credential literals; preserved firmware and Python REST/device utilities retain existing access material. Deployment exclusions were added, but controlled source remediation remains necessary.

**Provider rotation/revocation is required for the exposed Cashfree, PostgreSQL and Firebase service-account credentials.** See [security follow-up](security-followup.md). No secret values were displayed during this second pass, archived or included in new reports. No production systems were contacted and no history rewrite occurred.

## 6. Validation

Static checks passed: 23 retained JS/MJS syntax parses, 7 Python AST parses, 642 literal local/alias import resolutions, unchanged hashes for all protected/existing retained files apart from four reviewed changes, exact Git deletions and recovery checks, ignore matching and git diff --check. No newly broken or unresolved local imports were found.

TypeScript, lint, full build, TypeScript/unit/integration tests, browser flows and firmware compilation were not run because dependencies/toolchain or verified isolated infrastructure are absent. No skipped runtime check is reported as passed. See [validation results](validation-results.md) for individual statuses and parsed-file lists.

## 7. Reconciled statistics

| Metric | Value |
|---|---:|
| Original non-Git files | 875 |
| First-pass deletions | 5 |
| Second-pass deletions | 240 |
| Total deletions | 245 |
| Original files retained | 630 |
| First-pass report additions | 3 |
| Second-pass report/manifest additions | 7 |
| Final non-Git files (temporary helpers excluded) | 640 |
| Original root files | 302 |
| Root files removed (both passes) | 231 |
| Final root files | 71 |
| Removed Python files | 164 |
| Removed JS/TS/MJS utilities (second pass) | 44 |
| Removed firmware generations/directories | 5 |
| Mandatory protected firmware files unchanged | 30 |
| Second-pass PRESERVE candidate entries | 38 |
| Second-pass KEEP candidate entries | 52 |
| Second-pass DEFER candidate entries | 16 |
| Bytes removed in first pass | 268 |
| Bytes removed in second pass | 2222707 |
| Total bytes removed | 2222975 |
| Static validation failures | 0 |
| Unexpected existing-file modifications | 0 |
| Explicitly reviewed modifications | 4 |
| File moves | 0 |

Original-file reduction: 28.00%; root-file reduction: 76.49%. Removed bytes are 2,222,975 of 17,732,064 original bytes (12.54%), approximately 2.12 MiB. Report additions and four modified files add bytes separately; no claim that final footprint equals only original bytes minus deleted bytes. Extension counts overlap purpose categories: the 164 Python files include 163 patch/workflow tools and the dummy JSON snapshot; the 44 JS/TS/MJS files include 43 root utilities and one standalone src development probe. Disjoint category table above sums to 240.

## 8. Final repository structure

Remaining top-level directories:

- `.agents/`
- `FocusX_Scanner_Firmware_V5_DualRFID/`
- `ble_only_logic/`
- `docs/`
- `esp32_qr_access_changed/`
- `nodemcu_qr_access/`
- `prisma/`
- `public/`
- `rfid_only_logic/`
- `scripts/`
- `src/`
- `supabase/`
- `tests/`

Retained root utility files:

- `assign_kripa.mjs`
- `backfill.ts`
- `check_db.py`
- `check_db2.js`
- `cleanup.ts`
- `clear-sunny.ts`
- `delete_duplicates.ts`
- `dump_key.py`
- `fast_xyz.js`
- `fix-phones.ts`
- `fix_final.js`
- `fix_final2.js`
- `fix_lib.js`
- `fix_phones.ts`
- `fix_plan.js`
- `fix_raw.js`
- `fix_relay.ts`
- `fix_relay_ids.js`
- `fix_sub.js`
- `fix_time.js`
- `insert_claim.js`
- `insert_claim_pg.js`
- `make_admin.ts`
- `make_admin2.ts`
- `notify_all.ts`
- `onboard-kripa-seats.ts`
- `patch_db.py`
- `query_admins.ts`
- `query_relays.js`
- `query_schema.js`
- `read_crash.py`
- `read_serial.py`
- `read_serial_120.py`
- `recover_booking.ts`
- `resend_notification.ts`
- `resend_notifs.ts`
- `reset_kyc.ts`
- `revert_db.py`
- `scratch-seed.js`
- `seed.ts`
- `send_pwa_notif.ts`
- `simulate_java.js`
- `test_cf.ts`
- `test_db.ts`
- `update-shanti-seats.ts`
- `update_db.ts`
- `update_relay.ts`

All supported Next app, API, middleware, public/PWA assets, Prisma migration history, Sanity, tests and deployment/migration tooling remain. Four mandatory firmware directories plus offline RFID remain; five retired firmware directories are absent. Temporary cleanup helper files are excluded from inventories and removed before completion.

## 9. Final Git diff and recovery

Expected tracked diff: 245 exact unstaged deletions and four reviewed modifications. Untracked additions: seven second-pass reports/manifests, alongside the existing 14 user documents and three first-pass artifacts. No staged changes; HEAD remains `90c4b5a1700d3f5308086aa1f42f8f9dff5289ee`. The deleted-path set was compared with the two manifests; retained-file hash checks exclude only the four reviewed paths.

All deleted files are individually recoverable using the recorded exact path and source commit. Recovery instructions in the CSV require an absent destination; never broadly restore/reset or overwrite subsequent user work. Recovery proves source availability, not that removed firmware was deployed.

## 10. Remaining issues and verdict

- Urgent: rotate/revoke Cashfree/PostgreSQL/Firebase service-account credentials, review access logs and remediate retained hardcoded private access material in a controlled change.
- Install/validate dependencies only in an isolated development environment before package/prototype/component/compiler-config removal.
- Verify active firmware compilation and hardware contracts when the Arduino toolchain is available; no physical device action was performed.
- Confirm ongoing operational ownership of retained data-repair/admin/redelivery tools; no production repair status was inferred from filenames.

CLEANUP COMPLETED - VALIDATION PARTIAL. All authorized categories were reviewed and the defensible retirement set was executed. Deferred files were retained individually while independent safe batches continued. Supported behavior is protected structurally; production runtime behavior remains unverified. No commit or push was made.
