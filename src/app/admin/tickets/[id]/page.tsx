import { getSession } from '@/app/actions/auth-actions';
import prisma from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import { TicketThreadClient } from '@/app/dashboard/tickets/[id]/TicketThreadClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ticket Admin View | FocusX Support',
  description: 'Admin command center ticket thread and diagnostics view.',
};

export const dynamic = 'force-dynamic';

export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') redirect('/admin/login');

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
    redirect('/admin/tickets');
  }

  return (
    <div className="space-y-6">
      <TicketThreadClient
        ticket={ticket as any}
        sessionUserId={session.userId}
        sessionRole={session.role}
        isAdminView={true}
      />
    </div>
  );
}
