import { PrismaClient } from './node_modules/@prisma/client/default.js';
const prisma = new PrismaClient();
async function run() {
  const lib = await prisma.library.findFirst({
    where: { name: { contains: 'Kripa', mode: 'insensitive' } },
    include: { librarian: true }
  });
  console.log("Email:", lib ? lib.librarian.email : "Not found");
  await prisma.$disconnect();
}
run().catch(console.error);
