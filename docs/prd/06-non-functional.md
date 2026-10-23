# Phase 7: Non-Functional Requirements

**Summary**: An assessment of system qualities like security, performance, and reliability, based strictly on evidence in the codebase.
**Last verified against commit**: `90c4b5a1700d3f5308086aa1f42f8f9dff5289ee`

| Category | Status | Details & Evidence |
|----------|--------|--------------------|
| **Performance (Rate Limiting)** | Present | API rate limiting is actively applied to specific routes (API, sensitive, availability) via `@upstash/ratelimit` in `src/middleware.ts`. |
| **Reliability (Transactions & Refunds)** | Present | Booking flows use PostgreSQL transactions. A background `refund-worker.ts` and `/api/cron/process-refunds/route.ts` explicitly process and retry failed refunds. |
| **Security (Login & Permissions)** | Present | Relies on Firebase Auth. Server actions verify roles (e.g., `session.role === 'ADMIN'`). |
| **Security (Data Encryption)** | Absent | No field-level encryption tools like `bcrypt` were found in the codebase for PII (Aadhaar/Phones) beyond standard DB provider rest-encryption. (Verified via repo search for `bcrypt` and `encrypt`). |
| **Language & Localization (i18n)** | Absent | The UI is hardcoded in English. No internationalization libraries are used. (Verified via repo search for `i18n`, `next-i18next`, `react-intl`). |
| **Backups & Recovery** | Not determinable from code | The repository does not contain automated database backup scripts or `pg_dump` commands. Backups are presumably managed by the cloud database provider. |
| **Data Purging / Cleanup** | Absent | There are no scripts or cron jobs dedicated to deleting old logs, check-ins, or inactive users to save space. (Verified via repo search for `purge`, `cleanup`). |
| **Audit Logging & Exports** | Partial | The system logs physical entries and financial transactions. CSV Export is available on the dashboard (`DashboardOverviewClient.tsx:174`) for attendance data, but comprehensive audit logs for librarian actions are missing. |
| **Monitoring (APM)** | Absent | There are no explicit Application Performance Monitoring agents (like Datadog, Sentry, or New Relic) initialized in the codebase. (Verified via repo search). |
| **Automated Tasks (Cron/Auto-Checkout)** | Present | Vercel Cron routes successfully drive scheduled jobs. For example, `/api/cron/auto-checkout/route.ts` runs automatically to check out users who left without scanning. |
| **Accessibility (a11y)** | Absent | No ARIA roles or screen-reader focused configurations detected in base UI components. |
| **Device Support** | Present | Fully responsive design via Tailwind CSS breakpoint utilities (sm, md, lg). |
| **Input Validation** | Present | API inputs use schema validation or direct typing before hitting Prisma queries. |
