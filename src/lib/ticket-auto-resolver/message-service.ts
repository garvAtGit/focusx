import prisma from '@/lib/prisma';
import { computeReplyEscalation } from './escalation';

export interface UserSessionContext {
  userId: string;
  role: 'ADMIN' | 'LIBRARIAN' | 'STUDENT' | string;
  phone?: string | null;
  email?: string | null;
}

export interface AddTicketMessageDeps {
  prismaClient?: any;
  revalidateFn?: (path: string) => void;
}

/**
 * Core business logic for adding a message to a ticket thread.
 * Non-"use server" function suitable for direct testing and internal service calls.
 */
export async function addTicketMessageInternal(
  ticketId: string,
  content: string,
  isInternalNote: boolean,
  session: UserSessionContext,
  deps: AddTicketMessageDeps = {}
) {
  const db = deps.prismaClient || prisma;
  const revalidate = deps.revalidateFn;

  if (!content?.trim()) {
    return { success: false, error: 'Message cannot be empty.' };
  }

  const ticket = await db.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      library: { select: { id: true, name: true, librarianId: true } },
      creator: { select: { id: true, name: true } },
    },
  });

  if (!ticket) {
    return { success: false, error: 'Support ticket not found.' };
  }

  const isAdmin = session.role === 'ADMIN';
  const isOwner = ticket.library?.librarianId === session.userId;
  const isCreator = ticket.creatorId === session.userId;

  if (!isAdmin && !isOwner && !isCreator) {
    const staffMembership = await db.libraryStaff.findFirst({
      where: { libraryId: ticket.libraryId, userId: session.userId, status: 'ACTIVE' },
    });
    if (!staffMembership) {
      return { success: false, error: 'You do not have permission to view or reply to this ticket.' };
    }
  }

  const senderRole = isAdmin ? 'SUPPORT' : 'LIBRARIAN';
  const effectiveIsInternalNote = isAdmin ? Boolean(isInternalNote) : false;

  // Fetch prior public message BEFORE inserting the new message
  // This prevents the new librarian message from being inspected as its own prior bot message
  let lastPublicMessageSenderRole: string | null = null;
  if (!effectiveIsInternalNote && !isAdmin) {
    const priorPublicMessage = await db.ticketMessage.findFirst({
      where: { ticketId, isInternalNote: false },
      orderBy: { createdAt: 'desc' },
      select: { senderRole: true },
    });
    lastPublicMessageSenderRole = priorPublicMessage?.senderRole || null;
  }

  const message = await db.ticketMessage.create({
    data: {
      ticketId,
      senderId: session.userId,
      senderRole,
      content: content.trim(),
      isInternalNote: effectiveIsInternalNote,
    },
    include: {
      sender: {
        select: { id: true, name: true, role: true, profilePhotoUrl: true },
      },
    },
  });

  const { nextStatus, nextPriority, nextEscalatedAt } = computeReplyEscalation({
    isAdmin,
    isInternalNote: effectiveIsInternalNote,
    ticket: {
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      autoResolved: ticket.autoResolved,
      botAction: ticket.botAction,
      title: ticket.title,
      description: ticket.description,
      escalatedAt: ticket.escalatedAt,
    },
    lastPublicMessageSenderRole,
  });

  await db.supportTicket.update({
    where: { id: ticketId },
    data: {
      status: nextStatus,
      priority: nextPriority,
      escalatedAt: nextEscalatedAt,
      autoResolved: false, // Reset autoResolved flag on any human reply
      updatedAt: new Date(),
    },
  });

  // Notifications
  try {
    if (isAdmin && !effectiveIsInternalNote) {
      if (ticket.creatorId && ticket.creatorId !== session.userId) {
        await db.notification.create({
          data: {
            studentId: ticket.creatorId,
            userId: ticket.creatorId,
            title: `Reply on Ticket #${ticket.ticketNumber || ''}: ${ticket.title}`,
            message: content.trim().slice(0, 100),
            type: 'SUPPORT_TICKET',
            actionLabel: 'View Ticket',
            actionUrl: `/dashboard/tickets/${ticket.id}`,
          },
        });
      }
    } else if (!isAdmin) {
      const admins = await db.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
        take: 10,
      });
      for (const admin of admins) {
        await db.notification.create({
          data: {
            studentId: admin.id,
            userId: admin.id,
            title: `New Reply on Ticket #${ticket.ticketNumber || ''}: ${ticket.title}`,
            message: `${session.phone || 'Librarian'}: ${content.trim().slice(0, 80)}`,
            type: 'SUPPORT_TICKET',
            actionLabel: 'View Ticket',
            actionUrl: `/admin/tickets/${ticket.id}`,
          },
        });
      }
    }
  } catch (notifErr) {
    console.warn('[Ticket] Failed to dispatch reply notification:', notifErr);
  }

  if (revalidate) {
    try {
      revalidate(`/dashboard/tickets/${ticketId}`);
      revalidate(`/admin/tickets/${ticketId}`);
      revalidate('/dashboard/tickets');
      revalidate('/admin/tickets');
    } catch {}
  }

  return { success: true, message };
}

