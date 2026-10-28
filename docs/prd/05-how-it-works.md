# Phase 6: How It Works (For Non-Engineers)

**Summary**: A plain-language explanation of how FocusDesk is built, the external services it relies on, and what happens behind the scenes during a typical patron action.
**Last verified against commit**: `90c4b5a1700d3f5308086aa1f42f8f9dff5289ee`

## The Big Picture (Architecture)

FocusDesk is a single, unified "web application" that serves as both the website patrons visit and the central brain (server) that processes data.

```mermaid
flowchart TD
    Patron[Patron (Phone/Laptop)]
    Librarian[Librarian Dashboard]
    Scanner[Physical Scanner at Door]
    
    Brain[FocusDesk Central Brain]
    
    Database[(Main Database)]
    Payments[Razorpay (Payments)]
    Auth[Firebase (Login)]
    
    Patron -->|Visits Website| Brain
    Librarian -->|Manages Library| Brain
    Scanner -->|Sends QR/RFID Scans| Brain
    
    Brain --> Database
    Brain -.-> Auth
    Brain -.-> Payments
```

## Walkthrough: Booking a Seat and Checking In
1. **Choosing the Seat**: The patron selects a plan. The system temporarily locks this seat for 20 minutes (`BookingIntent` status: `HOLDING`).
2. **Paying**: The patron pays via Razorpay. 
3. **Confirmation**: Razorpay sends a secret webhook back to FocusDesk. FocusDesk creates a permanent `Booking` record.
4. **Scanning**: The patron scans the QR code at the physical scanner (running `FocusX_Scanner_Firmware_V5_DualRFID.ino (Holds `WIFI_SSID`, `WIFI_PASS`, `HARDWARE_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `READER_ID` credentials)`).
5. **Validation**: The scanner asks the database for permission. If valid, it unlocks the door and logs a "Check In".
6. **Live Update**: Supabase notices the new log and instantly pushes a message to the Librarian's dashboard.

## Key Backend API Routes
- `/api/checkout/reception`: (Staff) Librarian or Receptionist uses this to create a manual payment which is auto-approved, or creates a PENDING_PAYMENT booking.
- `/api/webhooks/razorpay`: (System) Razorpay payment webhook handler.
- `/api/relay/sync`: (Hardware) Synchronizes offline hardware logs using `x-api-key`.
- `/api/hardware/log`: (Hardware) Live check-in logging from scanners using `x-api-key`.
- Direct Supabase REST (`/rest/v1/Relay`): (Hardware) Scanners listen to real-time door unlock requests using `SUPABASE_ANON_KEY`.
- `/api/hardware/log`: (System/Hardware) Triggered by the door scanner to log an entry and command the door to unlock.
- `/api/kyc/cashfree/verify`: (Student) Submits identity for Aadhaar verification.
- `/api/cron/auto-checkout`: (System/Cron) A scheduled task that checks out patrons who forgot to scan out.

## External Services & Environment Variables
The application relies on several external services which must be configured using environment variables:
- **Database**: `DATABASE_URL`
- **Auth**: Firebase keys
- **Payments**: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
- **KYC**: `CASHFREE_VERIFICATION_CLIENT_ID`, `CASHFREE_VERIFICATION_CLIENT_SECRET`
- **Realtime / Dashboard**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Cron Security**: `CRON_SECRET`
**Additional Variables**: `NODE_ENV`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_WINTER_ARC_ACTIVE`

## Deployment and Automation
- **Where it runs**: Hosted on Vercel.
- **Cron Setup**: Scheduled jobs (Refunds, Auto-checkout, Notifications) run via Vercel Cron. They send an HTTP request to the `/api/cron/*` routes:
- `/api/cron/process-outbox` (Schedule: `0 0 * * *`)
- `/api/cron/process-refunds` (Schedule: `0 0 * * *`)
- `/api/cron/auto-checkout` (Schedule: `30 18 * * *`) authenticated by a `CRON_SECRET`.
