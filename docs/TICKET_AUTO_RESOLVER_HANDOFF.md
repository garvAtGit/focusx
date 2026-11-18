# FocusX Autonomous Ticket Auto-Resolver — Comprehensive Handoff & Architecture Guide

> **Audience**: Engineering team members continuing the Ticket Auto-Resolver system.  
> **Status as of November 2026**: Phase 1 Foundation & Shadow Mode complete and verified locally. Production is strictly read-only. Unpushed local commits are prepared.  
> **Repository Root**: `focusx-master`

---

## 1. Executive Summary & Goals

The **FocusX Ticket Auto-Resolver (FocusX Bot)** is an autonomous operational assistant designed to reduce support ticket backlog for library owners (librarians) using the FocusX B2B SaaS platform.

### What the System Solves
Librarians frequently raise tickets across three recurring operational domains:
1. **Student Booking Payments**: Student money was debited via UPI/Razorpay, but their seat booking status remains "Pending" on the dashboard due to client drop-off before webhook confirmation.
2. **Turnstile Gate / Hardware**: Scanner/gate offline, red light blinking, RFID card reader not triggering relays, ESP32 connectivity hang.
3. **Attendance & Stale Sessions**: Students tapped entry but exit wasn't marked, leading to active sessions crossing midnight or failing auto-checkout.

### Design Philosophy
- **Deterministic & Zero-Cost**: Does **NOT** rely on third-party LLMs (OpenAI, Gemini) for critical transactional decisions. Uses strict, regex-based Hinglish Natural Language Processing running in under **5 milliseconds** with zero hallucination risk, zero API costs, and complete student data privacy.
- **Fail-Closed & Safe**: If intent is ambiguous, has typos, contains multiple issues, or is a librarian payout dispute, it caps confidence strictly below 0.60 and leaves the ticket untouched for human staff.
- **Tenancy-First**: Students extracted from ticket text are strictly scoped to the raising librarian's library.
- **Instant Human Override**: Any human reply or clicking "Reopen" revokes bot ownership, resets `autoResolved = false`, raises priority (`URGENT` for payments, `HIGH` for hardware), and notifies admins at `/admin/tickets/[id]`.

---

## 2. Phase Roadmap & Current Status

| Phase | Description | Status | Next Actions |
| :--- | :--- | :---: | :--- |
| **Phase 1** | **Foundation, Triage, Atomic Leasing & Shadow Mode** | **COMPLETED & VERIFIED** | Ready for team review. Tested against 45 synthetic tickets. |
| **Phase 2** | **Online Payment Reconciliation (Razorpay)** | **SPECIFIED / PENDING CODE** | Wire `confirmOnlinePayment` / Razorpay fetch to `BookingIntent`. |
| **Phase 3** | **Hardware ESP32 Diagnostics & Attendance Stale Sessions** | **SPECIFIED / PENDING CODE** | Check Relay heartbeats + librarian-confirmed checkout button. |
| **Phase 4** | **Scheduled Sweeps, Cron Orchestration & Metrics** | **PLANNED** | Periodic sweep for stuck leases, Sentry error rate monitoring. |

---

## 3. Architecture Deep-Dive

### 3.1 Database Models (`prisma/schema.prisma`)
The system introduces 4 new columns to `SupportTicket` and an enum value to `TicketStatus`:

```prisma
enum TicketStatus {
  OPEN
  IN_PROGRESS
  WAITING_ON_LIBRARIAN
  RESOLVED
  CLOSED
  BOT_REPLIED           // New status: Bot posted public advice and awaits human response
}

model SupportTicket {
  id              String         @id @default(cuid())
  ticketNumber    Int            @default(autoincrement())
  title           String
  description     String
  category        TicketCategory
  priority        TicketPriority @default(MEDIUM)
  status          TicketStatus   @default(OPEN)
  libraryId       String
  creatorId       String
  deviceMac       String?
  escalatedAt     DateTime?      // Set when a bot ticket is reopened or escalated
  botAction       String?        // Audit log of bot execution (e.g., SHADOW_PAYMENT_PENDING)
  botConfidence   Float?         // Confidence score (0.00 to 1.00)
  botReason       String?        // Diagnostic rationale
  botProcessedAt  DateTime?      // Timestamp of bot lease evaluation
  autoResolved    Boolean        @default(false)
  resolvedAt      DateTime?
  closedAt        DateTime?
  // Relations...
}

model TicketMessage {
  id              String         @id @default(cuid())
  ticketId        String
  senderId        String
  senderRole      String         // 'SUPPORT', 'LIBRARIAN', 'BOT', 'SYSTEM'
  content         String
  isInternalNote  Boolean        @default(false) // Admin & internal bot diagnoses
  createdAt       DateTime       @default(now())
  // Relations...
}
```

### 3.2 Internal Note Leak Prevention
- Non-admin users (librarians) must **never** read `isInternalNote: true` messages (which contain bot shadow diagnoses, trace IDs, and admin notes).
- **Shared Query Helper**: `src/lib/ticket-query-helpers.ts`
  ```typescript
  export function getTicketMessageWhereClause(isAdmin: boolean) {
    return isAdmin ? undefined : { isInternalNote: false };
  }
  ```
  This helper is strictly enforced in:
  - `src/app/dashboard/tickets/[id]/page.tsx`
  - `src/app/dashboard/tickets/page.tsx`
  - Unit Test 11 in `tests/ticket-foundation.test.ts`.

### 3.3 Atomic Leasing Lock (`src/lib/ticket-auto-resolver/index.ts`)
To prevent two serverless invocations or parallel crons from double-processing the same ticket:
```typescript
const lease = await prisma.supportTicket.updateMany({
  where: {
    id: ticketId,
    status: { in: ['OPEN'] },
    botProcessedAt: null,
  },
  data: {
    botProcessedAt: new Date(),
    botAction: 'IN_PROGRESS',
  },
});

if (lease.count === 0) {
  // Lease lost: another process is handling it or ticket was closed/reopened
  return { action: 'LEASE_CONFLICT', resolved: false };
}
```

### 3.4 Triage Engine & Hinglish NLP (`src/lib/ticket-auto-resolver/triage.ts`)
1. **Strict Word Boundary Matching (`\b...\b`)**:
   Prevents false positives (e.g. `"investigate"` will **never** trigger `"gate"`).
2. **Tenancy-Scoped Student Extraction**:
   Extracts 10-digit Indian phones (`[6-9]\d{9}`) or UUIDs, then verifies via Prisma that the student has bookings, check-ins, or intents at `input.libraryId`. Enforces 0 / 1 / >1 rule:
   - 0 students found: `studentAmbiguity: 'ZERO_FOUND'`
   - 1 student found: `extractedStudent` assigned
   - >1 students found: `studentAmbiguity: 'MULTIPLE_FOUND'` (drops confidence)
3. **Librarian Payout Protection Guard**:
   Librarians often complain about branch payout delays using phrases like *"razorpay settlement for student bookings not credited to bank account"*.
   A strict guard checks for payout terms:
   ```typescript
   const isPayoutOrSettlementDispute =
     /\b(payout|settlement|bank transfer|bank account|vendor payout|weekly payout|monthly payout|branch payout|payout dispute)\b/i.test(combinedText);
   ```
   If true, it **refuses** to classify as `PAYMENT_PENDING`, forcing it to `UNKNOWN` with confidence `0.35` (< 0.60).
4. **Confidence Scoring**:
   - Matches intent + category + multiple keywords: `0.90` to `1.00`
   - Single keyword match: `0.70`
   - Multi-intent, unknown, typos, or payout disputes: capped strictly at `0.35` (fails closed).

### 3.5 Security Isolation: Server Actions vs. Internal Service
- **Rule**: Next.js Server Actions (`'use server'`) cannot have session overrides or trust caller identity arguments.
- **Implementation**:
  - `src/lib/ticket-auto-resolver/message-service.ts` contains `addTicketMessageInternal(ticketId, content, isInternalNote, session, deps)`.
  - `src/app/actions/ticket-actions.ts` exports `addTicketMessageAction` as a thin wrapper:
    ```typescript
    export async function addTicketMessageAction(ticketId: string, content: string, isInternalNote = false) {
      const session = await getSession();
      if (!session) return { success: false, error: 'Unauthorized: Please log in.' };
      return addTicketMessageInternal(ticketId, content, isInternalNote, session, { revalidateFn: revalidatePath });
    }
    ```

### 3.6 Reopen & Escalation Flow
In `src/app/actions/ticket-actions.ts`:
- **When Librarian Replies**: If prior public message was from `BOT`, automatically transitions ticket to `OPEN`, sets `escalatedAt = new Date()`, bumps priority (`URGENT` for money, `HIGH` for hardware), and resets `autoResolved = false`.
- **When Librarian Clicks Reopen**: `reopenTicketAction(ticketId, reason)` handles bot-handled tickets in `CLOSED` or `BOT_REPLIED` state, ignores `SHADOW_*` actions, updates priority, and dispatches notifications to admins pointing to `/admin/tickets/${ticket.id}`.

### 3.7 Redis Kill Switch (`src/lib/ticket-auto-resolver/flags.ts`)
- Configured via Upstash Redis (`UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`).
- Keys:
  - `ticket_bot:enabled`: `"true"` | `true`
  - `ticket_bot:shadow_mode`: `"true"` | `true` (Default: true)
  - `ticket_bot:dry_run`: `"true"` | `true` (Default: true)
- **Fail-Closed Guarantee**: If Redis is unreachable or times out (1500ms), flags default to `enabled: false, shadowMode: true, dryRun: true`. No automated writes can execute during Redis outages.

---

## 4. Production Database & Migrations Reality Check

### Current Production State
- **Database**: Supabase AWS ap-southeast-1 (Singapore) Postgres instance (`iiozcipbxsmjasgglsyf`).
- **Live Data Verified (Read-Only)**:
  - `CheckinLog`: 24,235 rows
  - `Booking`: 1,538 rows
  - `User`: 612 rows
  - `SupportTicket`: 1 row
  - `TicketMessage`: 3 rows

### Prisma Migrations History in Production
`_prisma_migrations` currently has **18 rows**:
- Rows 1–15: Historical baseline migrations.
- Row 16 (`20261021203000_notification_foundation`): Applied successfully (`finished_at = 2026-11-18 13:28:06Z`).
- Row 17 (`20261021204500_notification_broadcast`): Applied successfully (`finished_at = 2026-11-18 13:28:07Z`).
- Row 18 (`20261021213000_realtime_notifications`): **Failed & Rolled Back** (`rolled_back_at = 2026-11-18 13:28:28Z`).

### Why Migration 18 Failed
In `prisma/migrations/20261021213000_realtime_notifications/migration.sql`, line 44 runs:
```sql
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
```
Supabase owns the `realtime.messages` table under the `supabase_admin` system role. The application connection role (`postgres.iiozcipbxsmjasgglsyf`) lacks ownership rights, throwing PostgreSQL error `42501 (must be owner of table messages)`.

### How to Fix Migration 18 (When Approved)
1. **Edit the migration file**: Remove the `ALTER TABLE realtime.messages ...` block so Prisma only manages application tables (`RealtimeOutbox` in `public` schema).
2. **Execute the Supabase RLS policy as Superuser**: Run this directly in the Supabase Dashboard SQL Editor (which operates as `supabase_admin`):
   ```sql
   ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
   DROP POLICY IF EXISTS "Users can only subscribe to their own notification channel" ON realtime.messages;
   CREATE POLICY "Users can only subscribe to their own notification channel"
   ON realtime.messages FOR SELECT TO authenticated
   USING (topic = 'user:' || auth.uid());
   ```
3. Mark migration as resolved:
   ```bash
   npx prisma migrate resolve --applied 20261021213000_realtime_notifications
   ```

### Schema Drift Status
Running `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` returns:
```sql
-- This is an empty migration.
```
**There is zero schema drift.** All models in `prisma/schema.prisma` match the production database.

### Important: Vercel Deployments Do NOT Run Migrations
In `package.json`:
- `"build": "prisma generate && next build --webpack"`
- `"db:migrate:deploy": "node scripts/prepare-migrations.mjs && prisma migrate deploy"`

Vercel builds trigger `npm run build`. Pushing code to git **will NEVER automatically execute `prisma migrate deploy`**. Migrations must always be applied intentionally out-of-band.

---

## 5. Local Git Commits (Prepared on `master`, Unpushed)

The branch is currently 3 commits ahead of `origin/master`:

```bash
$ git log --oneline -3
5e44f2a feat(tickets): add autonomous ticket bot foundation with atomic leasing and triage
ed4dd45 fix(cron): per-student error isolation and failure status in auto-checkout
70bf07f fix(tickets): prevent internal note leakage to librarians in ticket detail and dashboard
```

1. **Commit A (`70bf07f`)**:
   - `src/lib/ticket-query-helpers.ts`
   - `src/app/dashboard/tickets/[id]/page.tsx`
   - `src/app/dashboard/tickets/page.tsx`
   - Fixes internal note leakage so librarians cannot see internal notes in lists or threads.
2. **Commit B (`ed4dd45`)**:
   - `src/app/api/cron/auto-checkout/route.ts`
   - Per-student error isolation inside try/catch with Sentry tags.
   - Returns HTTP 500 when `failedCount > 0` so Vercel Cron alerts fire properly.
3. **Commit C (`5e44f2a`)**:
   - `src/lib/ticket-auto-resolver/*` (triage, leasing, flags, message-service, escalation)
   - `src/app/actions/ticket-actions.ts` (reopen handling, thin wrapper)
   - `src/app/dashboard/tickets/[id]/TicketThreadClient.tsx` (reopen button)
   - `src/app/dashboard/tickets/page.tsx` (`export const maxDuration = 30;`)
   - `tests/ticket-foundation.test.ts` (21 unit tests)
   - `tests/ticket-bot-replay.test.ts` (45 replay scenarios)
   - `tsconfig.tests.json` (test type-checking)

---

## 6. How to Run Tests & Verification

### 6.1 Run Unit Tests (21 Tests)
```bash
npx tsx --test tests/ticket-foundation.test.ts
```
Covers:
- Hinglish payment & hardware intent extraction.
- Word boundary isolation (`investigate` vs `gate`).
- Category-only matches capping confidence < 0.60.
- Student tenancy matching (0 / 1 / >1).
- Internal note filter enforcement.
- Atomic lease update condition.
- Call order: `findFirst` executing before `create`.
- Priority escalation (`URGENT` on money, `HIGH` on hardware, never downgrading existing `URGENT`).
- Librarian payout disputes falling to `UNKNOWN`.

### 6.2 Run Replay Test Harness (45 Cases)
```bash
npx tsx --test tests/ticket-bot-replay.test.ts
```
Covers 45 synthetic Hinglish cases including:
- 6 Student Payment Pending
- 5 Payout Disputes
- 6 Hardware / Scanner Offline
- 5 Attendance / Stale Session
- 4 Multi-Intent Tickets
- 4 Ambiguous / General Questions
- 5 Hard Payout Disputes mentioning Razorpay / students
- 5 Blind Hinglish with zero keywords
- 5 Typos / Phonetic variants blind of keyword lists

**Output Statistics**:
- Total Accuracy: **100% (45/45)**
- High Confidence (`>= 0.80`): 37.8% (Targeted for automated action)
- Low Confidence (`< 0.60`): 62.2% (Safely routed to human queue)

### 6.3 Run TypeScript Compilation
```bash
# Type check application code
npx tsc --noEmit

# Type check tests code
npx tsc -p tsconfig.tests.json --noEmit
```
Both commands must exit with code 0 and zero errors.

---

## 7. Next Steps: How to Implement Phase 2 (Online Payments)

When ready to implement **Phase 2 (Razorpay Online Payment Reversal/Confirmation)**:

1. **Configure Environment**:
   Ensure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set in `.env.local` (they already exist in production Vercel).
2. **Implement Payment Handler**:
   Create `src/lib/ticket-auto-resolver/handlers/payment-handler.ts`:
   - Use `triage.extractedStudent.id`.
   - Query `BookingIntent` within that library for statuses `CREATED`, `PROCESSING`, `PAYMENT_FAILED`, or `HOLD_EXPIRED`.
   - Call Razorpay's API to inspect the payment status:
     - If captured: Reconcile payment using `confirmOnlinePayment` or create the booking.
     - If failed / refunded: Inform the librarian with transaction status.
     - If amount/currency mismatch: Escalate immediately to human admin (`URGENT`).
3. **Plug into Auto-Resolver**:
   In `src/lib/ticket-auto-resolver/index.ts`, replace `SHADOW_PAYMENT_PENDING` with the active handler when `flags.dryRun === false`.

---

## 8. Summary Checklist for the Next Teammate

- [ ] Do **NOT** run any DDL or `prisma migrate deploy` directly against the production database without first fixing migration 18 as described in Section 4.
- [ ] Run `npx tsx --test tests/ticket-foundation.test.ts tests/ticket-bot-replay.test.ts` to confirm your local environment is green.
- [ ] Review the 3 unpushed commits (`git log origin/master..master`).
- [ ] When ready to push Phase 1: You can safely push Commit A and Commit B first, verify them in staging/preview, and then deploy Commit C in Shadow Mode.

*Documentation maintained in `docs/TICKET_AUTO_RESOLVER_HANDOFF.md`.*
