import { getSession } from '@/app/actions/auth-actions';
import { getActiveLibrary } from '@/lib/dashboard-utils';
import prisma from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import { TicketThreadClient } from './TicketThreadClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ticket Thread | FocusX Support',
  description: 'Interactive conversation thread with FocusX Support engineering and operations team.',
};

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { id } = await params;
  if (!id) notFound();

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      library: {
        select: {
          id: true,
          name: true,
          locality: true,
          city: true,
        },
      },
      creator: {
        select: {
          id: true,
          name: true,
          phone: true,
          profilePhotoUrl: true,
        },
      },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              role: true,
              profilePhotoUrl: true,
            },
          },
        },
      },
    },
  });

  if (!ticket) {
    redirect('/dashboard/tickets');
  }

  // Permission check:
  // Must be an ADMIN, the ticket creator, or belong to the ticket's library.
  const isAdmin = session.role === 'ADMIN';
  const isCreator = session.userId === ticket.creatorId;

  if (!isAdmin && !isCreator) {
    const activeLib = await getActiveLibrary(session);
    if (!activeLib || activeLib.id !== ticket.libraryId) {
      redirect('/dashboard/tickets');
    }
  }

  return (
    <div className="container max-w-5xl mx-auto py-2">
      <TicketThreadClient
        ticket={ticket as any}
        sessionUserId={session.userId}
        sessionRole={session.role}
        isAdminView={false}
      />
    </div>
  );
}
