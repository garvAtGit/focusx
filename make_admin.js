const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const phones = [
    '7409757395', 
    '+917409757395', 
    '9354610893', 
    '+919354610893'
  ];
  
  const updated = await prisma.user.updateMany({
    where: {
      phone: {
        in: phones
      }
    },
    data: {
      role: 'ADMIN'
    }
  });
  
  console.log(`Updated ${updated.count} users to ADMIN.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
