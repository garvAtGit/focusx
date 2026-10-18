# Architecture Inventory

This is the canonical source of truth for the Library Near platform architecture. The repository is treated as the source of truth for implementation, but not automatically for production/runtime state.

## SYSTEM
- **Name**: Library Near
- **Purpose**: Library seat booking, physical access control, and library management platform.
- **Architecture style**: Monolith (Next.js App Router acting as Web App and REST API).
- **Main application**: Next.js Monolith.
- **Deployment**: Vercel (CONFIGURED_NOT_VERIFIED)
  - **Evidence**: `.env.vercel`, `.vercelignore`
  - **Production verification**: Not established from repository evidence.

## ACTORS
- **Student**
  - **Status**: ACTIVE
  - **Confidence**: HIGH
  - **Evidence**: Explicit `Role.STUDENT` in `schema.prisma`, route group `src/app/(student)/`.
  - **Code location**: `src/app/(student)/`
  - **Production verification**: Verified by execution paths in booking and profile management.
- **Librarian**
  - **Status**: ACTIVE
  - **Confidence**: HIGH
  - **Evidence**: `Role.LIBRARIAN`, `src/app/dashboard/`.
  - **Code location**: `src/app/dashboard/`
- **Receptionist**
  - **Status**: ACTIVE
  - **Confidence**: HIGH
  - **Evidence**: `Role.RECEPTIONIST`, utilized inside `src/app/dashboard/`.
- **Admin**
  - **Status**: ACTIVE
  - **Confidence**: HIGH
  - **Evidence**: `Role.ADMIN`, `src/app/admin/`.

## APPLICATIONS / INTERFACES
- **Student Web Portal**
  - **Status**: ACTIVE (Confidence: HIGH)
  - **Code location**: `src/app/(student)/`
- **Staff Dashboard**
  - **Status**: ACTIVE (Confidence: HIGH)
  - **Code location**: `src/app/dashboard/`
- **Admin Dashboard**
  - **Status**: ACTIVE (Confidence: HIGH)
  - **Code location**: `src/app/admin/`
- **Mobile API**
  - **Status**: ACTIVE (Confidence: HIGH)
  - **Evidence**: REST routes mapped at `src/app/api/mobile/`.
- **Mobile Application**
  - **Status**: UNKNOWN (Confidence: LOW)
  - **Evidence**: API routes exist to serve a mobile client, but no mobile codebase (React Native/Flutter/Swift) is present in this repository.
  - **Production verification**: Not established.
- **Hardware Relay**
  - **Status**: IMPLEMENTED_NOT_VERIFIED (Confidence: MEDIUM)
  - **Evidence**: `esp32_qr_access` directory, `/api/hardware/log/` routes exist.
  - **Production verification**: Hardware code exists, API routes exist, but active deployment to physical locations cannot be proven from the repo.

## BACKEND MODULES
- **API / Server Actions** (ACTIVE)
- **Authentication** (ACTIVE - verified via `middleware.ts` and `Firebase Admin`)
- **Booking Engine** (ACTIVE - verified via `src/lib/booking-engine/`)
- **Payment** (ACTIVE - verified via `src/app/api/webhooks/razorpay/`)
- **Access Control / Hardware Sync** (IMPLEMENTED_NOT_VERIFIED)

## EXTERNAL SERVICES
- **Firebase Auth**
  - **Status**: ACTIVE (Confidence: HIGH)
  - **Code location**: `src/lib/firebase/firebaseAdmin.ts`, `src/middleware.ts`
  - **Runtime path**: `middleware.ts` invokes firebase token verification for protected routes.
- **Razorpay Payments**
  - **Status**: ACTIVE (Confidence: HIGH)
  - **Code location**: `src/app/actions/razorpay-actions.ts`, `src/app/api/webhooks/razorpay/route.ts`
  - **Runtime path**: Booking action -> Razorpay API -> Webhook -> DB update.
- **Cashfree KYC**
  - **Status**: ACTIVE (Confidence: HIGH)
  - **Code location**: `src/app/api/kyc/cashfree/verify/route.ts`
  - **Runtime path**: Called directly from `ProfileClient.tsx`.
- **ImageKit Storage**
  - **Status**: ACTIVE (Confidence: HIGH)
  - **Code location**: `src/app/api/imagekit/auth/route.ts`
  - **Runtime path**: Client-side upload logic hits this for auth tokens.
- **Sanity CMS**
  - **Status**: CONFIGURED_NOT_VERIFIED (Confidence: MEDIUM)
  - **Evidence**: `src/sanity/`, `src/app/blog/`.
  - **Production verification**: Routes exist, but active usage/traffic cannot be confirmed.
- **Supabase Realtime**
  - **Status**: ACTIVE (Confidence: HIGH)
  - **Code location**: `src/components/LiveEntryLogs.tsx`
  - **Runtime path**: Client subscribes to Postgres changes via WebSocket to render live entry UI.

## INFRASTRUCTURE
- **Upstash Redis**
  - **Status**: ACTIVE (Confidence: HIGH)
  - **Code location**: `src/middleware.ts`, `src/lib/rate-limit.ts`
  - **Runtime path**: `middleware.ts` intercepts all API and Server Action calls to enforce rate limits via Upstash.
- **PostgreSQL Database**
  - **Status**: ACTIVE (Confidence: HIGH)
  - **Code location**: `prisma/schema.prisma`
  - **Runtime path**: Heavily queried throughout all Server Actions and API routes.
