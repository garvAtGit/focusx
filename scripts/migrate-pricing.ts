// @ts-nocheck
import prisma from '../src/lib/prisma';

async function main() {
  console.log('Starting pricing migration...');

  // 1. Migrate Seats
  const seats = await prisma.seat.findMany();
  let updatedSeats = 0;
  
  for (const seat of seats) {
    let lockerDaily = null;
    let premiumDaily = null;
    let needsUpdate = false;

    // Use 28 days as the monthly base as requested by the user
    if (seat.lockerPriceMonthly != null) {
      lockerDaily = Math.round(seat.lockerPriceMonthly / 28);
      needsUpdate = true;
    }
    
    if (seat.premiumPriceMonthly != null) {
      premiumDaily = Math.round(seat.premiumPriceMonthly / 28);
      needsUpdate = true;
    }

    if (needsUpdate) {
      await prisma.seat.update({
        where: { id: seat.id },
        data: {
          lockerPriceDaily: lockerDaily,
          premiumPriceDaily: premiumDaily
        }
      });
      updatedSeats++;
    }
  }

  console.log(`Updated ${updatedSeats} seats with daily pricing.`);

  // 2. Archive Premium Plans
  // In Prisma, we can just set isActive = false for plans where seatCategory is 'PREMIUM'
  // But wait, the schema still has PlanSeatCategory enum.
  // Actually, we'll just set them inactive.
  const archivedPlans = await prisma.plan.updateMany({
    where: { seatCategory: 'PREMIUM', isActive: true },
    data: { isActive: false }
  });

  console.log(`Archived ${archivedPlans.count} premium plans.`);
  
  console.log('Migration complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
