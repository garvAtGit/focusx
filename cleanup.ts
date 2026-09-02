import prisma from './src/lib/prisma';

async function main() {
  const users = await prisma.user.findMany({
    where: { name: "" }
  });
  console.log("Found empty name users:", users);

  for (const u of users) {
    await prisma.user.delete({ where: { id: u.id } });
    console.log("Deleted duplicate user:", u.id);
  }
}

main().finally(() => prisma.$disconnect());
