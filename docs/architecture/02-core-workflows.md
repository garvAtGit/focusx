# Core Workflows

## 1. Authentication
The application relies heavily on Firebase Auth for identity verification, which is strictly enforced via Edge middleware.

![Authentication Flow](diagrams/08-authentication-flow.mmd)

**CODE REFERENCES**:
- **Frontend Login**: `src/app/login/page.tsx`, `src/app/sso/page.tsx`
- **Firebase Client**: `src/lib/firebase/clientApp.ts`
- **Middleware**: `src/middleware.ts`
- **Token Verification**: `src/lib/verify-firebase-token.ts`
- **Firebase Admin**: `src/lib/firebase/firebaseAdmin.ts`
- **Database Model**: `User` (`prisma/schema.prisma`)

---

## 2. Booking Creation & Payment (Two-Phase Commit)
Bookings hold a seat temporarily to prevent double-booking before payment is captured. The webhook is the absolute source of truth for a finalized booking.

![Booking Flow](diagrams/05-booking-flow.mmd)

**CODE REFERENCES**:
- **Frontend**: `src/app/(student)/library/[id]/book/BookingClient.tsx`
- **Server Action (Init)**: `src/app/actions/booking-actions.ts` -> `createBookingIntent`
- **Booking Engine (Logic)**: `src/lib/booking-engine/`
- **Database Models**: `BookingIntent`, `ResourceLease`, `Booking` (`prisma/schema.prisma`)
- **Payment Creation**: `src/app/actions/razorpay-actions.ts`
- **Webhook Endpoint**: `src/app/api/webhooks/razorpay/route.ts`
- **Razorpay Integration**: `src/lib/razorpay.ts`

---

## 3. Physical Access & Check-in
Hardware at physical locations (ESP32/NodeMCU relays) scan user QR codes/NFC tags. The backend authenticates this and broadcasts real-time entry events to the staff dashboard.

![Access Flow](diagrams/07-access-flow.mmd)

**CODE REFERENCES**:
- **API Endpoint (Hardware log)**: `src/app/api/hardware/log/route.ts`
- **API Endpoint (Relay sync)**: `src/app/api/relay/sync/route.ts`
- **Database Models**: `Relay`, `EntryLog`, `CheckinLog` (`prisma/schema.prisma`)
- **Realtime Publish**: Implied via Postgres changes
- **Realtime Subscribe (Dashboard)**: `src/components/LiveEntryLogs.tsx`
- **Supabase Client**: `src/lib/supabase-client.ts`

---

## 4. KYC / Aadhaar Verification
Students complete identity verification which directly updates their status.

**Workflow Trace**:
1. User submits details in UI.
2. API validates and calls Cashfree.
3. Database updates `kycAadhaarStatus`.

**CODE REFERENCES**:
- **Frontend**: `src/app/(student)/student/profile/ProfileClient.tsx`
- **API Endpoint**: `src/app/api/kyc/cashfree/verify/route.ts`
- **Integration**: `src/lib/cashfree.ts`
- **Database Model**: `User`

---

## 5. Automated Refunds (Cron Job)
Failed or cancelled bookings that require refunds are processed asynchronously via a worker.

![Refunds Flow](diagrams/10-refunds-flow.mmd)

**CODE REFERENCES**:
- **Cron Trigger API**: `src/app/api/cron/process-refunds/route.ts`
- **Worker Logic**: `src/lib/refund-worker.ts`
- **Database Model**: `RefundTask` (`prisma/schema.prisma`)
- **Integration**: `src/lib/razorpay.ts` (Refund APIs)

---

## 6. Library Onboarding (Admin)
New libraries require admin verification before they become fully active on the platform.

![Library Onboarding](diagrams/11-library-onboarding-flow.mmd)

**CODE REFERENCES**:
- **Frontend (Admin Dashboard)**: `src/app/admin/libraries/` (Assumed route)
- **API/Server Action**: `src/app/actions/admin-actions.ts`
- **Database Model**: `Library` (`kycStatus: PENDING -> APPROVED`)
