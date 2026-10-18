import prisma from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { loadBookingFacts } from "./booking-engine/server/server-fact-loader"
import { evaluateBookingSelection } from "./booking-engine/evaluate-selection"

export type PricingInput = {
  planId: string
  libraryId: string
  seatId?: string | null
  hasLocker?: boolean
  standaloneLockerId?: string | null
}

type PricingClient = Prisma.TransactionClient | typeof prisma

/**
 * @deprecated Use evaluateBookingSelection from booking-engine instead for full validation.
 * Proxy function for backwards compatibility with legacy UI.
 */
export async function computeExpectedAmountPaise(
  input: PricingInput,
  db: PricingClient = prisma,
): Promise<number | null> {
  const draft = {
    operation: 'ADD_STUDENT' as const,
    studentId: 'legacy-pricing-check', 
    libraryId: input.libraryId,
    planId: input.planId,
    seatId: input.seatId ?? null,
    attachedLockerSelected: input.hasLocker ?? undefined,
    standaloneLockerId: input.standaloneLockerId ?? null,
  }

  const actor = { role: 'ADMIN' as const, isLibraryOwner: true }
  const facts = await loadBookingFacts(draft, actor, db as Prisma.TransactionClient)

  const result = evaluateBookingSelection(draft, facts)
  
  if (result.status === 'READY') {
    return result.amountPaise
  }
  
  return null
}

/**
 * Compares an actually-paid paise amount to the expected amount with a 1-paisa
 * tolerance (rounding). Returns true when the payment is acceptable.
 */
export function amountMatches(paidPaise: number, expectedPaise: number): boolean {
  return Math.abs(paidPaise - expectedPaise) <= 1
}
