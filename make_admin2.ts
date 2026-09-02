import prisma from "./src/lib/prisma";

async function main() {
  const ids = [
    'fa0a26a5-e64b-4a8d-90e0-2c4e1885a3cc', // Piyush
    'c481002f-b52e-4c9b-b5bf-1606d9df178d'  // Garv active
  ];
  
  const updated = await prisma.user.updateMany({
    where: {
      id: {
        in: ids
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
