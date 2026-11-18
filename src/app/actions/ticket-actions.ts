'use server';

import prisma from '@/lib/prisma';
import { getSession } from './auth-actions';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';
import { autoResolveTicket } from '@/lib/ticket-auto-resolver';
import { computeReplyEscalation } from '@/lib/ticket-auto-resolver/escalation';
import { addTicketMessageInternal } from '@/lib/ticket-auto-resolver/message-service';

export interface CreateTicketInput {
  libraryId: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority?: TicketPriority;
  deviceMac?: string;
}

/**
 * Creates a new support ticket and logs its initial opening message.
 */
export async function createTicketAction(input: CreateTicketInput) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized: Please log in.' };
  }

  const { libraryId, title, description, category, priority = 'MEDIUM', deviceMac } = input;

  if (!title?.trim() || !description?.trim()) {
    return { success: false, error: 'Title and description are required.' };
  }

  if (!libraryId) {
    return { success: false, error: 'Library selection is required.' };
  }

  try {
    // Verify user has access to library or is an admin
    const library = await prisma.library.findUnique({
      where: { id: libraryId },
      select: { id: true, name: true, librarianId: true },
    });

    if (!library) {
      return { success: false, error: 'Library not found.' };
    }

    const isOwner = library.librarianId === session.userId;
    const isAdmin = session.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      const staffMembership = await prisma.libraryStaff.findFirst({
        where: { libraryId, userId: session.userId, status: 'ACTIVE' },
      });
      if (!staffMembership) {
        return { success: false, error: 'You do not have permission to raise tickets for this library.' };
      }
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        status: 'OPEN',
        libraryId,
        creatorId: session.userId,
        deviceMac: deviceMac?.trim() || null,
        messages: {
          create: {
            senderId: session.userId,
            senderRole: isAdmin ? 'ADMIN' : 'LIBRARIAN',
            content: description.trim(),
          },
        },
      },
      include: {
        library: { select: { name: true } },
        creator: { select: { name: true, phone: true } },
      },
    });

    // Notify admins about the new support ticket
    try {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
        take: 10,
      });

      for (const admin of admins) {
        if (admin.id !== session.userId) {
          await prisma.notification.create({
            data: {
              studentId: admin.id,
              userId: admin.id,
              title: `[Ticket #FX-${ticket.ticketNumber}] ${ticket.title}`,
              message: `${library.name} opened a ${ticket.priority} priority ${ticket.category} ticket.`,
              type: 'SUPPORT_TICKET',
              actionLabel: 'View Ticket',
              actionUrl: `/admin/tickets/${ticket.id}`,
            },
          });
        }
      }
    } catch (notifErr) {
      console.warn('[Ticket] Failed to dispatch admin notifications:', notifErr);
    }

    // Log library activity
    try {
      await prisma.libraryActivityLog.create({
        data: {
          libraryId,
          actorId: session.userId,
          actorName: session.phone || session.email || 'Staff',
          actorRole: session.role,
          actionType: 'TICKET_CREATED',
          description: `Raised support ticket #FX-${ticket.ticketNumber}: "${ticket.title}"`,
          metadata: { ticketId: ticket.id, ticketNumber: ticket.ticketNumber, category, priority },
        },
      });
    } catch {}

    revalidatePath('/dashboard/tickets');
    revalidatePath('/admin/tickets');

    // Trigger autonomous ticket triage/resolution non-blockingly
    try {
      after(async () => {
        try {
          await autoResolveTicket(ticket.id);
        } catch (botErr) {
          console.error('[createTicketAction] Auto-resolver background error:', botErr);
        }
      });
    } catch (afterErr) {
      console.warn('[createTicketAction] Failed to schedule after() job:', afterErr);
    }

    return {
      success: true,
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
    };
  } catch (error: any) {
    console.error('[createTicketAction] Error:', error);
    return { success: false, error: error?.message || 'Failed to create support ticket.' };
  }
}

/**
 * Adds a new message / reply to an existing support ticket thread.
 * Thin server action wrapper around internal message service.
 */
export async function addTicketMessageAction(
  ticketId: string,
  content: string,
  isInternalNote = false
) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized: Please log in.' };
  }

  return addTicketMessageInternal(ticketId, content, isInternalNote, session, {
    revalidateFn: revalidatePath,
  });
}

/**
 * Updates a ticket's status (OPEN, IN_PROGRESS, WAITING_ON_LIBRARIAN, RESOLVED, CLOSED).
 */
export async function updateTicketStatusAction(ticketId: string, status: TicketStatus) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized: Please log in.' };
  }

  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        library: { select: { id: true, name: true, librarianId: true } },
      },
    });

    if (!ticket) {
      return { success: false, error: 'Support ticket not found.' };
    }

    const isAdmin = session.role === 'ADMIN';
    const isOwner = ticket.library.librarianId === session.userId;
    const isCreator = ticket.creatorId === session.userId;

    // Both admins and librarians can mark as RESOLVED or CLOSED, or reopen (OPEN)
    if (!isAdmin && !isOwner && !isCreator) {
      return { success: false, error: 'Permission denied.' };
    }

    const data: any = {
      status,
      autoResolved: false, // Reset autoResolved to false on any human status update
      updatedAt: new Date(),
    };

    if (status === 'RESOLVED') {
      data.resolvedAt = new Date();
      data.escalatedAt = null; // Cleared on resolution
    } else if (status === 'CLOSED') {
      data.closedAt = new Date();
      data.escalatedAt = null; // Cleared on close
    } else if (status === 'OPEN' || status === 'IN_PROGRESS') {
      data.closedAt = null;
    }

    const updated = await prisma.supportTicket.update({
      where: { id: ticketId },
      data,
    });

    // Add automated audit message in the thread
    await prisma.ticketMessage.create({
      data: {
        ticketId,
        senderId: session.userId,
        senderRole: 'SYSTEM',
        content: `Ticket status updated to ${status} by ${isAdmin ? 'FocusX Support' : (session.phone || 'Librarian')}.`,
        isInternalNote: false,
      },
    });

    try {
      revalidatePath(`/dashboard/tickets/${ticketId}`);
      revalidatePath(`/admin/tickets/${ticketId}`);
      revalidatePath('/dashboard/tickets');
      revalidatePath('/admin/tickets');
    } catch {}

    return { success: true, status: updated.status };
  } catch (error: any) {
    console.error('[updateTicketStatusAction] Error:', error);
    return { success: false, error: error?.message || 'Failed to update ticket status.' };
  }
}

/**
 * Updates ticket priority.
 */
export async function updateTicketPriorityAction(ticketId: string, priority: TicketPriority) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized.' };
  }

  try {
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { priority, updatedAt: new Date() },
    });

    revalidatePath(`/dashboard/tickets/${ticketId}`);
    revalidatePath(`/admin/tickets/${ticketId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to update priority.' };
  }
}

/**
 * Explicitly reopens a ticket for Human Admin support.
 */
export async function reopenTicketAction(ticketId: string, reason?: string) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized: Please log in.' };
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      ticketNumber: true,
      title: true,
      description: true,
      category: true,
      priority: true,
      status: true,
      autoResolved: true,
      libraryId: true,
      creatorId: true,
      botAction: true,
    },
  });

  if (!ticket) {
    return { success: false, error: 'Ticket not found.' };
  }

  const isAdmin = session.role === 'ADMIN';
  const isOwner = ticket.creatorId === session.userId;

  if (!isAdmin && !isOwner) {
    const staffMembership = await prisma.libraryStaff.findFirst({
      where: { libraryId: ticket.libraryId, userId: session.userId, status: 'ACTIVE' },
    });
    if (!staffMembership) {
      return { success: false, error: 'You do not have permission to reopen this ticket.' };
    }
  }

  const isBotReplied = ticket.status === 'BOT_REPLIED';
  const isBotResolved = ticket.status === 'RESOLVED' && ticket.autoResolved;
  const isClosedBotHandled =
    ticket.status === 'CLOSED' &&
    Boolean(
      (ticket.botAction && !ticket.botAction.startsWith('SHADOW_') && ticket.botAction !== 'UNPROCESSED') ||
      ticket.autoResolved
    );

  // Strict check: Only bot-replied, bot-resolved, or closed bot-handled tickets (ignoring SHADOW_ actions) may be reopened by librarians
  if (!isAdmin && !isBotReplied && !isBotResolved && !isClosedBotHandled) {
    return {
      success: false,
      error: 'Only bot-handled or bot-resolved tickets can be reopened. For other tickets, please reply in the discussion thread.',
    };
  }

  const isMoneyRelated =
    ticket.category === 'BILLING_PAYOUTS' ||
    (ticket.botAction && ticket.botAction.startsWith('PAYMENT_')) ||
    /\b(payment|paise|rupees|rs|inr|razorpay|refund|deducted)\b/i.test(`${ticket.title} ${ticket.description}`);

  // Priority may ONLY be raised (never lower an existing URGENT to HIGH)
  let nextPriority: TicketPriority = ticket.priority;
  if (isMoneyRelated) {
    nextPriority = 'URGENT';
  } else if (ticket.priority !== 'URGENT') {
    nextPriority = 'HIGH';
  }

  await prisma.$transaction(async (tx) => {
    await tx.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: 'OPEN',
        priority: nextPriority,
        escalatedAt: new Date(),
        autoResolved: false, // Reset on human reopen
        closedAt: null,
        updatedAt: new Date(),
      },
    });

    await tx.ticketMessage.create({
      data: {
        ticketId,
        senderId: session.userId,
        senderRole: isAdmin ? 'SUPPORT' : 'LIBRARIAN',
        content: reason?.trim()
          ? `[Reopened for Human Support]: ${reason.trim()}`
          : 'Reopened for Human Support assistance.',
        isInternalNote: false,
      },
    });
  });

  // Notify admins about the escalation
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
      take: 10,
    });
    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          studentId: admin.id,
          userId: admin.id,
          title: `[ESCALATED #FX-${ticket.ticketNumber}] ${ticket.title}`,
          message: `${session.phone || 'Librarian'} escalated ticket for human support.`,
          type: 'SUPPORT_TICKET',
          actionLabel: 'View Ticket',
          actionUrl: `/admin/tickets/${ticket.id}`,
        },
      });
    }
  } catch (err) {
    console.warn('[reopenTicketAction] Failed to dispatch admin notifications:', err);
  }

  revalidatePath(`/dashboard/tickets/${ticketId}`);
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath('/dashboard/tickets');
  revalidatePath('/admin/tickets');

  return { success: true };
}
