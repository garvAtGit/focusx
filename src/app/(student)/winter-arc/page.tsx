import { getSession } from "@/app/actions/auth-actions";
import prisma from "@/lib/prisma";
import WinterArcClient from "./WinterArcClient";

export default async function WinterArcPage() {
  const session = await getSession();
  let pledge = null;

  if (session) {
    pledge = await prisma.winterArcEnrollment.findUnique({
      where: { studentId: session.userId },
    });
  }

  // Serialize for the client component (strip Prisma metadata)
  const serializedPledge = pledge
    ? {
        leagueHours: pledge.leagueHours,
        targetHours: pledge.targetHours,
        discount: pledge.discount,
      }
    : null;

  return <WinterArcClient initialPledge={serializedPledge} />;
}
