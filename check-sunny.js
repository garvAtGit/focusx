const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const student = await prisma.student.findUnique({
    where: { phone: '7827658220' },
    include: {
      bookings: {
        include: {
          plan: true,
          seat: true
        }
      }
    }
  });
  console.log(JSON.stringify(student, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
