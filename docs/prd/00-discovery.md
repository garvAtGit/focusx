# Phase 1: Discovery

**Summary**: FocusDesk (FocusX) is a library and study space management platform enabling students to book seats and library administrators to monitor attendance and access. It integrates a Next.js web application with custom ESP32 hardware for RFID/QR-based physical access control.
**Last verified against commit**: `90c4b5a1700d3f5308086aa1f42f8f9dff5289ee`

## Directory Tree (Depth 3)

The repository root (`focusx/`) contains the following key directories:

- `FocusX_Scanner_Firmware*/` - Multiple versions of C++/Arduino firmware for ESP32-based RFID and QR code access scanners.
- `docs/`
  - `architecture/` - System architecture documentation.
- `prisma/`
  - `migrations/` - Database migration scripts.
  - `schema.prisma` - PostgreSQL database schema definition.
- `public/` - Static web assets.
- `scripts/` - Various utility and maintenance scripts.
- `src/`
  - `app/` - Next.js App Router containing pages and API routes (`admin`, `dashboard`, `login`, `api`, etc.).
  - `components/` - Reusable React UI components (e.g., `LiveSeatMap.tsx`, `AccessQRModal.tsx`).
  - `hooks/` - Custom React hooks.
  - `lib/` - Core business logic, booking engines, payment integrations, and utilities.
- `supabase/` - Configuration for Supabase integration.
- `tests/` - Integration and unit tests.

## Technology Stack

- **Languages**: TypeScript, JavaScript (Web); C++, Python (Hardware & Scripts).
- **Frameworks & Libraries**: Next.js (App Router), React, Tailwind CSS, Prisma ORM.
- **Databases**: PostgreSQL (managed via Prisma). Redis (via Upstash).
- **Third-Party Services**:
  - **Auth & Backend**: Supabase, Firebase (admin and push notifications).
  - **Payments**: Razorpay, Cashfree.
  - **Content & Media**: Sanity (CMS), ImageKit (Image processing).
  - **Hardware Comm**: WebSockets, REST APIs (for ESP32 devices).
- **Deployment**: Configured for Vercel (`vercel.json`) and Next.js default build pipeline.

## Entry Points

- **User Interfaces**:
  - Web dashboards for students/patrons (`/(student)`) to manage bookings.
  - Admin dashboards (`/admin`, `/dashboard`) for librarians to view live occupancy, manage users, and handle overrides.
- **Hardware Integrations**:
  - ESP32 scanners connect to the system to report RFID swipes and QR code scans, updating attendance in real-time.
- **Background & API**:
  - Next.js API routes (`src/app/api`) handle backend requests, webhooks (payments), and hardware communication.
  - Workers like `refund-worker.ts` handle background financial reconciliation.

## Product Purpose

FocusDesk is a comprehensive library and study space management system. It allows patrons to purchase subscriptions, book specific seats, and gain physical entry using RFID cards or generated QR codes. For librarians and administrators, it provides real-time monitoring of seat occupancy, automated attendance tracking, access control hardware integration, and payment processing for library memberships.

**Evidence**:
- Patrons & Seats: `src/lib/booking-authority.ts`, `src/components/LiveSeatMap.tsx`
- Hardware Access: `FocusX_Scanner_Firmware_V5_DualRFID/`, `src/components/AccessQRModal.tsx`
- Admin operations: `src/app/admin/`, `src/components/LiveEntryLogs.tsx`
- Payments: `src/lib/razorpay.ts`, `src/lib/cashfree.ts`
