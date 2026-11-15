import { getSession } from '@/app/actions/auth-actions';
import prisma from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { AdminTicketsClient } from './AdminTicketsClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Support Tickets | Admin Command Center',
  description: 'Triage and resolve partner library support tickets.',
};

export const dynamic = 'force-dynamic';

export default async function AdminTicketsPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') redirect('/admin/login');

  const tickets = await prisma.supportTicket.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      library: {
        select: {
          id: true,
          name: true,
          city: true,
        },
      },
      creator: {
        select: {
          name: true,
          phone: true,
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          content: true,
          senderRole: true,
          createdAt: true,
        },
      },
      _count: {
        select: { messages: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <AdminTicketsClient tickets={tickets as any} />
    </div>
  );
}
