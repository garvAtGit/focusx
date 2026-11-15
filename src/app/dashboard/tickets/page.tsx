import { getSession } from '@/app/actions/auth-actions';
import { getActiveLibrary } from '@/lib/dashboard-utils';
import prisma from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { TicketsDashboardClient } from './TicketsDashboardClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Support & Tickets | FocusX Staff Portal',
  description: 'Raise and manage B2B operations and hardware support tickets for your library.',
};

export default async function DashboardTicketsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const activeLib = await getActiveLibrary(session);
  if (!activeLib) {
    redirect('/dashboard');
  }

  // Fetch all tickets for this library
  const rawTickets = await prisma.supportTicket.findMany({
    where: { libraryId: activeLib.id },
    orderBy: { updatedAt: 'desc' },
    include: {
      creator: {
        select: { name: true, phone: true, profilePhotoUrl: true },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { content: true, senderRole: true, createdAt: true },
      },
      _count: {
        select: { messages: true },
      },
    },
  });

  // Fetch relays / scanners so hardware tickets can reference devices
  const relays = await prisma.relay.findMany({
    where: { libraryId: activeLib.id },
    select: {
      id: true,
      nfcTagId: true,
      macAddress: true,
      status: true,
    },
  });

  return (
    <div className="container max-w-5xl mx-auto py-2">
      <TicketsDashboardClient
        tickets={rawTickets as any}
        relays={relays}
        libraryId={activeLib.id}
        libraryName={activeLib.name}
        sessionRole={session.role}
      />
    </div>
  );
}
