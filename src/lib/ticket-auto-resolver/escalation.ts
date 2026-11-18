import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';

export interface ComputeReplyEscalationInput {
  isAdmin: boolean;
  isInternalNote: boolean;
  ticket: {
    status: TicketStatus;
    priority: TicketPriority;
    category: TicketCategory;
    autoResolved: boolean;
    botAction: string | null;
    title: string;
    description: string;
    escalatedAt: Date | null;
  };
  lastPublicMessageSenderRole?: string | null;
}

export interface ComputeReplyEscalationOutput {
  nextStatus: TicketStatus;
  nextPriority: TicketPriority;
  nextEscalatedAt: Date | null;
  shouldEscalate: boolean;
}

/**
 * Computes status, priority, and escalation timestamp transitions on ticket reply.
 * Rules:
 * 1. Admin reply clears escalation and sets WAITING_ON_LIBRARIAN (unless already closed/resolved).
 * 2. Librarian reply on BOT_REPLIED, bot-RESOLVED (autoResolved: true), or when last public message
 *    was from BOT escalates ticket to OPEN + sets escalatedAt.
 * 3. Priority on escalation:
 *    - Money-related -> URGENT
 *    - Other -> HIGH, but NEVER lowers an existing URGENT to HIGH.
 * 4. Normal WAITING_ON_LIBRARIAN reply -> transitions to IN_PROGRESS, NO escalation.
 */
export function computeReplyEscalation(input: ComputeReplyEscalationInput): ComputeReplyEscalationOutput {
  const { isAdmin, isInternalNote, ticket, lastPublicMessageSenderRole } = input;
  let nextStatus = ticket.status;
  let nextPriority = ticket.priority;
  let nextEscalatedAt = ticket.escalatedAt;
  let shouldEscalate = false;

  if (isInternalNote) {
    return { nextStatus, nextPriority, nextEscalatedAt, shouldEscalate };
  }

  if (isAdmin) {
    nextEscalatedAt = null;
    if (ticket.status !== 'CLOSED' && ticket.status !== 'RESOLVED') {
      nextStatus = 'WAITING_ON_LIBRARIAN';
    }
  } else {
    const isBotLast = lastPublicMessageSenderRole === 'BOT';
    const isBotResolved = ticket.status === 'RESOLVED' && ticket.autoResolved;
    const isBotReplied = ticket.status === 'BOT_REPLIED';

    if (isBotReplied || isBotResolved || isBotLast) {
      nextStatus = 'OPEN';
      nextEscalatedAt = new Date();
      shouldEscalate = true;

      const isMoneyRelated =
        ticket.category === 'BILLING_PAYOUTS' ||
        Boolean(ticket.botAction && ticket.botAction.startsWith('PAYMENT_')) ||
        /\b(payment|paise|rupees|rs|inr|razorpay|refund|deducted)\b/i.test(`${ticket.title} ${ticket.description}`);

      if (isMoneyRelated) {
        nextPriority = 'URGENT';
      } else if (ticket.priority !== 'URGENT') {
        nextPriority = 'HIGH';
      }
    } else {
      // Normal admin/librarian exchange
      if (ticket.status === 'WAITING_ON_LIBRARIAN' || ticket.status === 'RESOLVED') {
        nextStatus = 'IN_PROGRESS';
      }
    }
  }

  return { nextStatus, nextPriority, nextEscalatedAt, shouldEscalate };
}

