# Phase 4: Functional Requirements (Operations & Hardware)

**Summary**: Detailed functional requirements for Hardware Access, Monitoring, Workflow Automation, and Campaigns.
**Last verified against commit**: `90c4b5a1700d3f5308086aa1f42f8f9dff5289ee`

## F-012: Dynamic QR Code & Hardware Entry
**User Story**: As a student, I want to scan my phone at the gate so I can enter the library.
**Current Behavior**: QR payload is generated via `generateEntryQR` using a secret key.
**Evidence**: `src/lib/web-scanner.ts`, `AccessQRModal.tsx`

## F-013: RFID Tag Assignment
**User Story**: As a librarian, I want to assign an RFID card to a patron for physical entry.
**Current Behavior**: Librarian enters a UID string matching the physical card into the patron's profile.
**Evidence**: `AssignRFIDModal.tsx`

## F-014: Hardware Syncing
**User Story**: As a system, I need to log physical entry even if the internet drops.
**Current Behavior**: ESP32 scanner reads QR/RFID. It hits `/api/hardware/log/route.ts` or posts directly to Supabase (`/rest/v1/Relay?bleReaderId=eq.`). 
**Business Rules**: If `UNLOCK_IN` or `UNLOCK_OUT` is received, the firmware physically unlocks the door. It implements a 150ms debounce (`isDoorRattling`) and grace period (`hasDoorOpenedDuringGrace`) for door sensors.
**Evidence**: `FocusX_Scanner_Firmware_V5_DualRFID.ino:259`, `src/app/api/hardware/log/route.ts`

## F-015: Live Dashboard
**User Story**: As a librarian, I want to see real-time library occupancy.
**Current Behavior**: `DashboardOverviewClient.tsx` listens to Supabase WebSocket events to update counts instantly.
**Business Rules**: Can export attendance via a client-side generated CSV (`handleExportCSV()`).
**Evidence**: `DashboardOverviewClient.tsx:174`

## F-016: Attendance Tracking
**User Story**: As a librarian, I want to track how many hours students actually spend studying.
**Current Behavior**: Pairs `CHECK_IN` and `CHECK_OUT` logs.
**Business Rules**: 
- Breaks > 90 minutes (`breakMs > 1.5 * 60 * 60 * 1000`) are deducted from total active hours on the dashboard.
- NOTE: The Winter Arc leaderboard simply sums total minutes; it does not explicitly deduct breaks in the same way.
**Evidence**: `src/app/dashboard/DashboardAttendance.tsx`, `DashboardOverviewClient.tsx:335`

## F-017: Financial Reports
**User Story**: As a librarian, I want to track revenue and expenses.
**Current Behavior**: Consolidates `CONFIRMED` and `COMPLETED` bookings to calculate realized revenue. Subtracts manual `Expense` entries for net profit.
**Business Rules**: Flags suspicious revocations (where a plan was cancelled 24+ hours after purchase).
**Evidence**: `src/app/dashboard/financials/page.tsx`

## F-018: Rules Engine (Workflow Automation)
**User Story**: As a librarian, I want the system to automatically warn students who overstay.
**Current Behavior**: Triggers like `auto-checkout` cron or checkout APIs call `fireRules()`.
**Business Rules**: 
- Cooldown: One execution per rule per student per IST calendar day (`istOffsetMs = 5.5 * 60 * 60 * 1000`).
**Evidence**: `src/lib/rule-engine.ts:96`

## F-019: Push Notifications
**User Story**: As a librarian, I want to send manual or automated alerts to students.
**Current Behavior**: A Vercel Cron hits `/api/cron/notifications/route.ts` (`Authorization: Bearer CRON_SECRET`) to process pending notifications.
**Evidence**: `src/app/api/cron/notifications/route.ts`

## F-020: Winter Arc Leaderboard
**User Story**: As a student, I want to see how I rank against others in study hours.
**Current Behavior**: Enabled if `WINTER_ARC_ACTIVE="true"`. Sums total check-in minutes.
**Business Rules**: Only displays the top 5 students (`slice(0,5)`).
**Evidence**: `src/app/(student)/student/dashboard/page.tsx:85`, `CozyWinterDashboard.tsx`
