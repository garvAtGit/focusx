# Code Map

## BOOKING ENGINE
- **Frontend**: `src/app/(student)/library/[id]/book/BookingClient.tsx`
- **Server Action**: `src/app/actions/booking-actions.ts`
- **API**: `src/app/api/webhooks/razorpay/route.ts`
- **Business Logic**: `src/lib/booking-engine/`
- **Database**: `prisma/schema.prisma` (`Booking`, `BookingIntent`, `ResourceLease`)
- **External**: Razorpay `src/lib/razorpay.ts`

## HARDWARE / ACCESS
- **Frontend**: `src/components/LiveEntryLogs.tsx`
- **API**: `src/app/api/hardware/log/route.ts`
- **Database**: `prisma/schema.prisma` (`Relay`, `EntryLog`, `CheckinLog`)
- **External**: Supabase `src/lib/supabase-client.ts`

## AUTHENTICATION
- **Frontend**: `src/app/login/page.tsx`
- **Middleware**: `src/middleware.ts`
- **API**: `src/app/api/auth/session/route.ts`
- **Business Logic**: `src/lib/verify-firebase-token.ts`
- **Database**: `User` model
- **External**: Firebase `src/lib/firebase/firebaseAdmin.ts`

## DASHBOARD / STAFF
- **Frontend**: `src/app/dashboard/`
- **Server Actions**: `src/app/actions/staff-actions.ts`
- **Business Logic**: `src/lib/dashboard-utils.ts`
- **Database**: `Library`, `Seat`, `Plan`, `Inquiry`
