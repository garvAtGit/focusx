# Validation results - second cleanup pass

Production behavior has not been verified. Static checks do not prove live database, payment, authentication, hardware or browser behavior.
| Check | Status | Evidence / scope |
|---|---|---|
| Original-content/Git recovery | PASSED | Every second-pass deletion matched SHA-256 of Git checkout-filtered content at 90c4b5a1700d3f5308086aa1f42f8f9dff5289ee before deletion; exact per-file manifest written first. |
| Protected firmware | PASSED | 30 files in mandatory four directories unchanged; RFID offline experiment also unchanged. |
| Retained original content | PASSED | All retained second-pass baseline hashes unchanged except four explicitly reviewed ignore/document changes. |
| Unrelated user work and first-pass outputs | PASSED | 14 prior untracked audit/PRD files and first-pass report, CSV and baseline unchanged. |
| Local/alias imports | PASSED | 642 literal relative/@ imports checked before/after; zero newly broken or unresolved local targets. Computed dynamic imports and unknown external usage are not proven by this scan. |
| Package/deployment/build consumers | PASSED | No retained package/config/test/app caller targets removed root utilities or retired firmware; active Prisma migration preparation remains. |
| JavaScript syntax | PASSED | node --check parsed 23 retained JS/MJS files; no module was executed; dependencies are not required by this parser check. |
| Python syntax | PASSED | AST parsing of 7 retained Python utilities; no script executed. |
| Ignore rules | PASSED | Secret/generated rules match; no NUL bytes; git check-ignore --no-index found none of 504 retained source/test/schema/asset/document paths ignored. |
| Git diff | PASSED | Expected deletions and four known modifications only; git diff --check passes; branch/HEAD unchanged; no staged changes. |
| TypeScript | NOT RUN - unavailable | No locally installed TypeScript/node_modules. No npx installation attempted. |
| ESLint | NOT RUN - unavailable | No installed ESLint/node_modules; no auto-fix attempted. |
| Next build | NOT RUN - unavailable | No installed Next/Prisma/dependencies. Build lifecycle includes prisma generate then next build; neither ran. |
| Booking/other TypeScript unit tests | NOT RUN - unavailable | tsx/Prisma and required dependencies absent. |
| Booking authority integration | NOT RUN - unsafe / unavailable | Writes through TEST_DATABASE_URL; no isolated local database verified. |
| Hardware API acceptance | NOT RUN - unsafe / unavailable | Posts scan events; no isolated server/database/hardware verified. |
| Firmware compilation | NOT RUN - unavailable | Arduino CLI/core/libraries absent; no flashing/device access. |
| UI/browser flows | NOT RUN - unavailable | No local built app/browser fixture; application/prototype/component removals deferred. |
| Dependencies/lockfile cleanup | PARTIALLY VERIFIED | @yudiel scanner is imported by maintained dashboard; html5-qrcode/styled-components have no active import found, but installation/lockfile validation unavailable, so packages/lockfile unchanged. |

## Baseline interpretation

Retained JS/Python files are unchanged from baseline, so parser results also apply to their pre-cleanup contents. No baseline or cleanup-induced syntax failure was found. No source behavior was refactored. Public prototype routes remain; the private design folder is not used as evidence of public routing. The installed-version Next documentation directory is unavailable. The [official project-structure guide](https://nextjs.org/docs/app/getting-started/project-structure) was consulted for route/private-folder semantics; no Next API implementation/configuration code was authored.

## Parsed JavaScript files

- `assign_kripa.mjs`
- `check_db2.js`
- `eslint.config.mjs`
- `fast_xyz.js`
- `fix_final.js`
- `fix_final2.js`
- `fix_lib.js`
- `fix_plan.js`
- `fix_raw.js`
- `fix_relay_ids.js`
- `fix_sub.js`
- `fix_time.js`
- `insert_claim.js`
- `insert_claim_pg.js`
- `postcss.config.mjs`
- `public/sw.js`
- `query_relays.js`
- `query_schema.js`
- `scratch-seed.js`
- `scripts/generate-ec-keys.js`
- `scripts/prepare-migrations.mjs`
- `scripts/reset_kyc.js`
- `simulate_java.js`

## Parsed Python files

- `check_db.py`
- `dump_key.py`
- `patch_db.py`
- `read_crash.py`
- `read_serial.py`
- `read_serial_120.py`
- `revert_db.py`

## Five review perspectives

- Software: supported routes/APIs/domain functions unchanged; standalone development probe only source deletion.
- Firmware: mandatory four directories unchanged; retired hardware interfaces preserve security/journaling counterparts; RFID offline prototype retained.
- Database: schema, migrations, seed and recovery/repair utilities preserved; no migration or DB call.
- Security: no new secret values displayed or archived; private export removed and tracked remaining access material explicitly reported.
- DevOps: exact-path Git recovery, package/compiler/cron preservation, verified ignore hygiene and no commit/push.

These are five review perspectives applied by this agent, not a claim that five independent agents were run.
