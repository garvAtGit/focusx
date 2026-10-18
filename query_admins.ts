import prisma from "./src/lib/prisma";

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { phone: { contains: '7409757395' } },
        { phone: { contains: '9354610893' } },
        { role: 'ADMIN' }
      ]
    },
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      authId: true
    }
  });
  
  console.log("Users found:");
  console.table(users);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
