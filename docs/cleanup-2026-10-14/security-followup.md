# Security follow-up - repository cleanup does not resolve credential exposure

No credential, token, private key or private connection-string value is included in these deliverables. No production service was contacted, no credential was used or rotated, and no Git history was rewritten.

## Confirmed exposure and completed working-tree changes

- `cf_key.txt`: tracked standalone Cashfree credential file, removed after confirming no current consumer; application uses environment variables.
- `hack.json`: tracked unreferenced environment export containing a complete Firebase private-key PEM, confirmed in memory without displaying its value; removed.
- PostgreSQL password-bearing connection strings: obsolete read-only probes, including all `test_db*.mjs` snapshots, removed. The first-pass tool output also displayed a connection string; treat that credential as exposed.
- `.gitignore`: all 37 corrupt NUL bytes removed, existing meaningful patterns preserved, secret-export and generated-output rules added. The previously corrupt `push_env.js`, `cf_key.txt` and `test_cf.ts` rules now work.
- `.vercelignore`: standalone credential exports, retained literal-credential tooling and protected firmware directories explicitly excluded from the web deployment. These exclusions do not remove files from Git or validate deployment behavior.

## Still tracked: controlled remediation required

These retained database/device repair tools contain database password literals. Their operational retirement/completion was not established, so they remain unchanged and are now excluded from web deployment:

- `fast_xyz.js`
- `fix_final.js`
- `fix_final2.js`
- `fix_lib.js`
- `fix_plan.js`
- `fix_raw.js`
- `fix_relay_ids.js`
- `fix_sub.js`
- `fix_time.js`
- `insert_claim_pg.js`

Retained Python REST/device utilities (`check_db.py`, `dump_key.py`, `patch_db.py`, `revert_db.py`) contain literal access material whose scope/privilege has not been established. Protected firmware retains existing embedded device/API/Wi-Fi access material by explicit preservation instruction. Audit key scope and privileges; public anonymous keys are not automatically equivalent to private/service credentials. These are tracked-source remediation items, even where ignore/deployment patterns now match.

## Required provider and repository follow-up

1. Revoke/rotate the exposed Cashfree credentials, relevant PostgreSQL credentials, and the Firebase service-account private key through their providers. Coordinate deployment secret updates and operational continuity.
2. Inspect provider access logs, service-account/database permissions and unexpected changes. This cleanup makes no claim about misuse.
3. Replace retained hardcoded private credentials with explicitly required environment configuration in a controlled, locally validated change. Do not execute the tools against production as a test.
4. Perform an approved secret scan across current source and history; plan coordinated history remediation separately if warranted. Never force-push/history-rewrite as part of this cleanup.
5. Verify Vercel build/deployment exclusions in a safe preview before merge/push. All cleanup changes remain uncommitted.

Deleting working-tree files or fixing `.gitignore` does not erase secrets from historical commits, prior clones or prior tool output. No plaintext archive was created. Hashes in manifests describe whole source files and are not secret values.
