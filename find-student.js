const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      name: {
        contains: 'ishu',
        mode: 'insensitive'
      }
    },
    include: {
      bookings: true,
      BookingIntent: true,
    }
  });
  
  console.log(JSON.stringify(users, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
