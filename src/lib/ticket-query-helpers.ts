/**
 * Shared Prisma where-clause helper for TicketMessage queries.
 *
 * Rules:
 * 1. Non-admin users (librarians, staff) must strictly be restricted to non-internal notes.
 * 2. Admins are permitted to see all messages, including internal notes and bot shadow diagnoses.
 */
export function getTicketMessageWhereClause(isAdmin: boolean) {
  return isAdmin ? undefined : { isInternalNote: false };
}

