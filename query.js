const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { phone: '+919821483011' },
    include: {
      bookings: {
        include: { library: true, plan: true, seat: true, standaloneLocker: true }
      }
    }
  });
  console.log(JSON.stringify(user, null, 2));
}

main().finally(() => prisma.$disconnect());
