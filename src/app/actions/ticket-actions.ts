'use server';

import prisma from '@/lib/prisma';
import { getSession } from './auth-actions';
import { revalidatePath } from 'next/cache';
import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';

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
 */
export async function addTicketMessageAction(ticketId: string, content: string, isInternalNote = false) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized: Please log in.' };
  }

  if (!content?.trim()) {
    return { success: false, error: 'Message cannot be empty.' };
  }

  try {
    const ticket = await prisma.supportTicket.findUnique({
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
    const isOwner = ticket.library.librarianId === session.userId;
    const isCreator = ticket.creatorId === session.userId;

    if (!isAdmin && !isOwner && !isCreator) {
      const staffMembership = await prisma.libraryStaff.findFirst({
        where: { libraryId: ticket.libraryId, userId: session.userId, status: 'ACTIVE' },
      });
      if (!staffMembership) {
        return { success: false, error: 'You do not have permission to view or reply to this ticket.' };
      }
    }

    const senderRole = isAdmin ? 'SUPPORT' : 'LIBRARIAN';

    const message = await prisma.ticketMessage.create({
      data: {
        ticketId,
        senderId: session.userId,
        senderRole,
        content: content.trim(),
        isInternalNote: isAdmin ? isInternalNote : false,
      },
      include: {
        sender: {
          select: { id: true, name: true, role: true, profilePhotoUrl: true },
        },
      },
    });

    // Update ticket status intelligently based on who replied
    let nextStatus = ticket.status;
    if (!isInternalNote) {
      if (isAdmin) {
        // Support replied -> status moves to WAITING_ON_LIBRARIAN unless already closed
        if (ticket.status !== 'CLOSED' && ticket.status !== 'RESOLVED') {
          nextStatus = 'WAITING_ON_LIBRARIAN';
        }
      } else {
        // Librarian replied -> status moves to IN_PROGRESS so support knows new info arrived
        if (ticket.status === 'WAITING_ON_LIBRARIAN' || ticket.status === 'RESOLVED') {
          nextStatus = 'IN_PROGRESS';
        }
      }
    }

    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: nextStatus,
        updatedAt: new Date(),
      },
    });

    // Notification dispatch:
    try {
      if (isAdmin && !isInternalNote) {
        // Support replied -> notify the ticket creator / librarian
        await prisma.notification.create({
          data: {
            studentId: ticket.creatorId,
            userId: ticket.creatorId,
            title: `Support update on Ticket #FX-${ticket.ticketNumber}`,
            message: `FocusX Support replied to "${ticket.title}". Tap to view discussion.`,
            type: 'SUPPORT_REPLY',
            actionLabel: 'Open Ticket',
            actionUrl: `/dashboard/tickets/${ticket.id}`,
          },
        });
      } else if (!isAdmin) {
        // Librarian replied -> notify admins
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
              title: `New reply on Ticket #FX-${ticket.ticketNumber}`,
              message: `${session.phone || 'Librarian'} replied to "${ticket.title}".`,
              type: 'SUPPORT_REPLY',
              actionLabel: 'View Ticket',
              actionUrl: `/admin/tickets/${ticket.id}`,
            },
          });
        }
      }
    } catch (notifErr) {
      console.warn('[Ticket] Failed to dispatch reply notification:', notifErr);
    }

    revalidatePath(`/dashboard/tickets/${ticketId}`);
    revalidatePath(`/admin/tickets/${ticketId}`);
    revalidatePath('/dashboard/tickets');
    revalidatePath('/admin/tickets');

    return { success: true, message };
  } catch (error: any) {
    console.error('[addTicketMessageAction] Error:', error);
    return { success: false, error: error?.message || 'Failed to post message.' };
  }
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
      updatedAt: new Date(),
    };

    if (status === 'RESOLVED') {
      data.resolvedAt = new Date();
    } else if (status === 'CLOSED') {
      data.closedAt = new Date();
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

    revalidatePath(`/dashboard/tickets/${ticketId}`);
    revalidatePath(`/admin/tickets/${ticketId}`);
    revalidatePath('/dashboard/tickets');
    revalidatePath('/admin/tickets');

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
