const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const bookings = await prisma.booking.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { plan: true, library: true, seat: true, standaloneLocker: true }
  });
  console.log(JSON.stringify(bookings, null, 2));
}
check().catch(console.error).finally(() => prisma.$disconnect());
