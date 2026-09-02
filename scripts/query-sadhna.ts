import prisma from '../src/lib/prisma';

async function main() {
  const users = await prisma.user.findMany({
    where: {
      name: {
        contains: 'sadhna',
        mode: 'insensitive'
      }
    },
    include: {
      bookings: true
    }
  });

  console.log(JSON.stringify(users, null, 2));
}
main();
