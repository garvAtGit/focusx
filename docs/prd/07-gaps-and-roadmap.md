# Phase 8: Gaps, Risks, and Roadmap

**Summary**: An analysis of system risks, missing features hinted at by the codebase, and prioritized recommendations for the product roadmap.
**Last verified against commit**: `90c4b5a1700d3f5308086aa1f42f8f9dff5289ee`

## Gaps and Unfinished Features

1. **TODOs and FIXMEs**: *No TODOs or FIXMEs were found in the `src/` directory after a full codebase scan.* 
2. **KYC Verification**: The schema has `KycStatus` and Aadhaar fields, and there's a Cashfree API integration (used *only* for Aadhaar verification, not payments), but it does not appear to be fully enforced as a hard gate for all library entry workflows.
3. **Documentation Mismatch**: The repository `README.md` is the default Next.js boilerplate template.

## Major Risks

### Aadhaar and PII Storage Risk (Critical)
The system retrieves and stores highly sensitive Personally Identifiable Information (PII), including Aadhaar Verification IDs, exact Dates of Birth, Names, and exact physical movement times (entry/exit logs). There is no explicit field-level encryption for this data in the codebase (`schema.prisma`). A database breach would result in a severe leak of biometric-linked identity data alongside exact physical habits of students.

### Risks for Librarians
1. **Single Points of Failure**: If Vercel goes down or the hardware scanner breaks, automated check-ins and the dashboard halt.
2. **Data Loss via Soft Deletion**: As there is no historical archiving tool, deleting a `Seat` directly from the database could permanently orphan historical financial and booking records.

## Prioritized Recommendations (Top 5)

### Now (Critical Fixes & Stability)
1. **Encrypt PII**: Implement field-level encryption (e.g., Prisma Field Encryption) for Aadhaar IDs and phone numbers.
2. **Update README.md**: Replace boilerplate with actual local setup and hardware deployment instructions.

### Next (Workflow Improvements)
3. **Database Backups**: Schedule automated PG dumps.
4. **Offline-Pay Grace Period**: Allow students to enter the library for 1 hour pending staff approval.
5. **Internationalization (i18n)**: Prepare strings for localization.
6. **Role Guards**: Enhance UI checks to match backend security.
7. **Library-System Integration**: Add hooks for external institutional databases.
3. **Audit Logging**: Create an `AdminLog` table to track when staff change prices or override rules.
4. **Data Archiving Job**: Implement a cron worker to move check-in logs older than 90 days into cold storage.
5. **Decoupled Campaigns**: Refactor "Winter Arc" out of core dashboard logic into a dynamic "Challenges" engine.
