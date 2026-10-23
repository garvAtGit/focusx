# Phase 3: Feature Inventory

**Summary**: A comprehensive list of system features categorized by area, noting their exact implementation status and evidence in the codebase.
**Last verified against commit**: `90c4b5a1700d3f5308086aa1f42f8f9dff5289ee`

| ID | Name | Status | Roles | Evidence (File : Function) |
|----|------|--------|-------|----------------------------|
| **Sign-in & Authentication** |
| F-001 | Phone OTP Login | Implemented | All | `src/app/login/page.tsx : handleSendOtp` |
| F-002 | Staff Role Routing | Implemented | All | `src/app/actions/auth-actions.ts : handleAuthResult` |
| **Catalog & Resources** |
| F-003 | Library Discovery | Implemented | Student | `src/app/(student)/libraries/page.tsx : default export` |
| F-004 | Seat Mapping | Implemented | Staff | `src/components/LiveSeatMap.tsx : LiveSeatMap` |
| F-005 | Plan Management | Implemented | Staff | `src/app/dashboard/plans/page.tsx : default export` |
| F-006 | Standalone Lockers | Partial | Staff | `src/lib/booking-engine/server/server-fact-loader.ts` (Logic exists but UI routing in `/plans` is absent) |
| **Session & Booking Management** |
| F-007 | Online Checkout | Implemented | Student | `src/lib/razorpay.ts : createOrder`, `booking-authority.ts : createOnlineBookingIntent` |
| F-008 | Offline Checkout | Implemented | Student | `src/app/api/checkout/reception/route.ts : POST` |
| F-009 | Payment Approvals | Implemented | Staff | `src/app/dashboard/approvals/page.tsx : default export` |
| F-010 | Pause / Resume | Implemented | Student | `src/components/student/PauseResumeButton.tsx : handlePauseResume` |
| F-011 | Plan Extension | Implemented | Student | `src/components/student/ExtendPlanModal.tsx : handleExtend` |
| **Access & Hardware** |
| F-012 | Dynamic QR Code | Implemented | Student | `src/components/AccessQRModal.tsx : generateEntryQR` |
| F-013 | RFID Tag Assignment | Implemented | Staff | `src/components/dashboard/AssignRFIDModal.tsx : handleAssign` |
| F-014 | Hardware Syncing | Implemented | System | `FocusX_Scanner_Firmware_V5_DualRFID.ino`, `src/app/api/hardware/log/route.ts` |
| **Monitoring & Reports** |
| F-015 | Live Dashboard | Implemented | Staff | `src/app/dashboard/DashboardOverviewClient.tsx : default export` |
| F-016 | Attendance Tracking | Implemented | Staff | `src/app/dashboard/DashboardAttendance.tsx : default export` |
| F-017 | Financial Reports | Implemented | Staff | `src/app/dashboard/financials/page.tsx : default export` |
| **Workflow Automation** |
| F-018 | Rules Engine | Implemented | Staff | `src/lib/rule-engine.ts : fireRules` |
| F-019 | Push Notifications | Implemented | Staff, System | `src/app/api/cron/notifications/route.ts`, `ManualNotifyModal.tsx` |
| **Special Campaigns** |
| F-020 | Winter Arc Leaderboard | Implemented | Student | `src/components/winter-arc/CozyWinterDashboard.tsx : CozyWinterDashboard` |

*Status Key: Implemented (Works end-to-end), Partial (Some paths missing/hardcoded), Stubbed (UI exists, mocked logic), Dead (Unused schema/code).*
