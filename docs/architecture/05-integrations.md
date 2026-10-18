# Integrations

## Firebase Auth
- **Purpose**: Core authentication (OTP, custom tokens, session management).
- **Status**: ACTIVE
- **Confidence**: HIGH
- **Evidence**: Initialized in `src/lib/firebase/firebaseAdmin.ts` and `src/lib/firebase/clientApp.ts`.
- **Runtime path**: `middleware.ts` invokes `verify-firebase-token.ts` on every protected request. Frontend components rely on Firebase Auth SDK.
- **Production verification**: Verified by execution path in `middleware.ts` which blocks unauthorized traffic.

## Razorpay
- **Purpose**: Payment gateway for bookings.
- **Status**: ACTIVE
- **Confidence**: HIGH
- **Evidence**: Configured in `src/lib/razorpay.ts`. 
- **Runtime path**: `src/app/actions/razorpay-actions.ts` calls order API. `src/app/api/webhooks/razorpay/route.ts` listens to payment success.
- **Production verification**: Validated by active two-phase commit booking logic.

## Cashfree
- **Purpose**: Aadhaar KYC verification.
- **Status**: ACTIVE
- **Confidence**: HIGH
- **Evidence**: `src/lib/cashfree.ts` API client.
- **Runtime path**: `ProfileClient.tsx` frontend explicitly calls `src/app/api/kyc/cashfree/verify/route.ts` which processes the verification and updates the database.
- **Production verification**: Active code path in student profile management.

## ImageKit
- **Purpose**: Image storage (avatars, library photos).
- **Status**: ACTIVE
- **Confidence**: HIGH
- **Evidence**: `src/lib/imagekit.ts`.
- **Runtime path**: Frontend file upload components retrieve auth parameters via `src/app/api/imagekit/auth/route.ts`.
- **Production verification**: Verified by active API route.

## Supabase Realtime
- **Purpose**: WebSocket streaming for UI (Entry Logs).
- **Status**: ACTIVE
- **Confidence**: HIGH
- **Evidence**: `src/lib/supabase-client.ts`.
- **Runtime path**: `LiveEntryLogs.tsx` subscribes directly to Postgres triggers using the Supabase client.
- **Production verification**: Verified by UI usage.

## Sanity
- **Purpose**: CMS for Blog.
- **Status**: CONFIGURED_NOT_VERIFIED
- **Confidence**: MEDIUM
- **Evidence**: `src/sanity/` and `src/app/blog/`.
- **Runtime path**: Blog pages query Sanity client.
- **Production verification**: Not established from repository evidence whether the blog is actively published or used in production.
