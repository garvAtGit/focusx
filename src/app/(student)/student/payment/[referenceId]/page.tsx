import { notFound, redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { getSession } from "@/app/actions/auth-actions"
import { PaymentStatusClient } from "./PaymentStatusClient"

export default async function PaymentStatusPage({
  params,
}: {
  params: Promise<{ referenceId: string }>
}) {
  const session = await getSession()
  if (!session?.userId) {
    redirect("/login")
  }

  const { referenceId } = await params
  const intent = await prisma.bookingIntent.findFirst({
    where: {
      referenceId,
      studentId: session.userId,
    },
    select: {
      status: true,
      failureReason: true,
    },
  })
  if (!intent) notFound()

  return (
    <main className="mx-auto flex min-h-[65vh] max-w-xl items-center px-4 py-12">
      <PaymentStatusClient
        referenceId={referenceId}
        initialStatus={intent.status}
        initialReason={intent.failureReason}
      />
    </main>
  )
}
