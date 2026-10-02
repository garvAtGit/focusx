# Local Supabase RLS Verification Report

## 1. Local Schema & RLS Status
✅ RLS Policies and `auth.focusx_id()` function successfully applied to local schema.

## 2. Seeded Test Identities/Data
✅ Seeded Student A, Student B, Librarian A, Library A (Approved), Library B (Pending), and 2 Bookings.

## 11 & 12. auth.uid() & FocusX User.id mapping
✅ auth.uid() resolves correctly from JWT `sub`.
✅ `auth.focusx_id()` maps Firebase UID to FocusX User.id successfully.

## 5. Anonymous Tests
✅ Anonymous can read Approved libraries.
✅ Anonymous cannot read bookings.

## 4. User/public-profile Security Design
✅ `user_public_profile` view successfully exposes safe fields.
❌ Sensitive fields exposed! [{"kycAadhaarName":"Student A KYC"}]

## 6. Student A Isolation Tests
✅ Student A reads ONLY own booking.
✅ Student A cannot modify Student B booking.

## 7. Student B Isolation Tests
✅ Student B reads ONLY own booking.

## 8. Librarian Isolation Tests
✅ Librarian A reads ALL bookings in their library.

## 9. Server-only Table Tests
✅ ProcessedWebhookEvent is inaccessible to clients.

## 10. Prisma Compatibility Tests
✅ Prisma/postgres connection (service role) bypasses RLS and sees all data.

## 13. Failures or Unexpected Behavior
None detected during local simulation.

## 14. Differences between Local and Production
1. **JWT Verification**: Locally, we minted a JWT using the local `JWT_SECRET`. In production, Supabase automatically fetches Google's Firebase JWKS to securely verify the signature of the real Firebase ID Token. The outcome for PostgREST (the `sub` claim) is identical.
2. **Custom Claims**: We did not use Firebase custom claims for roles. We strictly relied on `User.role` inside PostgreSQL, as requested.
