# Phase 4: Functional Requirements (Core & Booking)

**Summary**: Detailed functional requirements for Authentication, Catalog, and Session/Booking Management.
**Last verified against commit**: `90c4b5a1700d3f5308086aa1f42f8f9dff5289ee`

## F-001: Phone OTP Login
**User Story**: As a user, I want to sign in with my phone number so that I don't have to remember a password.
**Current Behavior**: 10-digit number. Firebase Auth sends 6-digit OTP. 60-second resend cooldown (`setResendTimer(60)`).
**Business Rules**: Defaults new users to `STUDENT` role (`role Role @default(STUDENT)`).
**Evidence**: `src/app/login/page.tsx`, `schema.prisma`

## F-002: Staff Role Routing
**User Story**: As staff, I want to be taken to my dashboard automatically upon login.
**Current Behavior**: `handleAuthResult` redirects `ADMIN` or `LIBRARIAN` to `/dashboard`, and `STUDENT` to `/(student)/student/dashboard`.
**Business Rules**: Session role dictates layout rendering and data fetching filters.
**Evidence**: `src/app/actions/auth-actions.ts`

## F-003: Library Discovery
**User Story**: As a student, I want to see a list of libraries to pick where to study.
**Current Behavior**: Displays libraries.
**Business Rules**: Only shows libraries where `isActive` is true.
**Evidence**: `src/app/(student)/libraries/page.tsx`

## F-004: Seat Mapping
**User Story**: As a librarian, I want to define a grid of seats so that students can pick specific spots.
**Current Behavior**: Librarians manage seats by specifying `gridX`, `gridY`, name, and type.
**Business Rules**: Types are `NORMAL`, `PREMIUM`, `RESERVED`, `NON_RESERVABLE`.
**Evidence**: `Seat` model, `src/components/LiveSeatMap.tsx`

## F-005: Plan Management
**User Story**: As a librarian, I want to create subscription plans.
**Current Behavior**: Librarian sets duration, price, and type (`FIXED` vs `FLEXIBLE`).
**Business Rules**: Flexible plans allow custom hours; Fixed plans have hard start/end times.
**Evidence**: `src/app/dashboard/plans/page.tsx`, `Plan` model

## F-006: Standalone Lockers
**User Story**: As a student, I want to rent a locker without a seat.
**Current Behavior**: Evaluated in `server-fact-loader.ts`, verifying locker availability during checkout.
**Known Gaps/Limitations**: UI route in `/dashboard/plans` for explicitly creating standalone lockers is partially missing.
**Evidence**: `src/lib/booking-engine/server/server-fact-loader.ts`

## F-007 & F-008: Online & Offline Checkout
**User Story**: As a student, I want to purchase a plan online or pay cash at the desk.
**Current Behavior**: Uses Razorpay for online, manual for cash.
**Business Rules**: 
- Online hold: 20 minutes (`ONLINE_HOLD_MINUTES = 20`).
- Manual hold: 24 hours (`MANUAL_HOLD_MINUTES = 24 * 60`).
- Transactions are serialized and retry 3 times (`SERIALIZABLE_RETRIES = 3`).
**Evidence**: `src/lib/booking-authority.ts`, `src/app/api/checkout/reception/route.ts`

## F-009: Payment Approvals
**User Story**: As a receptionist, I want to approve cash payments.
**Current Behavior**: Librarian hits "Approve", changing `PENDING_PAYMENT` to `CONFIRMED`.
**Business Rules**: Cache is purged immediately on approval for real-time dashboard updates (`// Purge caches so the librarian sees the pending approval instantly`).
**Evidence**: `src/app/api/checkout/reception/route.ts:187`, `src/app/dashboard/approvals/page.tsx`

## F-010: Pause / Resume Booking
**User Story**: As a student, I want to pause my booking if I go on vacation so I don't lose days.
**Current Behavior**: Student pauses an active plan. `isPaused = true`.
**Evidence**: `src/components/student/PauseResumeButton.tsx`

## F-011: Plan Extension
**User Story**: As a student, I want to extend my plan before it expires.
**Current Behavior**: Creates a new booking starting exactly when the current one ends.
**Evidence**: `src/components/student/ExtendPlanModal.tsx`

## Refunds (Background Worker)
**User Story**: As a student, I want an automatic refund if my payment succeeds but my seat was taken.
**Current Behavior**: `refund-worker.ts` triggered by cron retries failed Razorpay refunds.
**Evidence**: `src/app/api/cron/process-refunds/route.ts`, `RefundTask` model

## Wallet Balance (Dead Feature)
**Current Behavior**: `walletBalance` exists in `User` schema but has no usage or functional UI in `src/`.
**Status**: Dead.
**Evidence**: `schema.prisma`
