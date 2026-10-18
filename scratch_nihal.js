const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const bookings = await prisma.booking.findMany({
    where: {
      student: {
        name: {
          contains: 'Nihal',
          mode: 'insensitive'
        }
      }
    },
    include: {
      student: true,
      plan: true
    }
  });
  console.log(JSON.stringify(bookings, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
