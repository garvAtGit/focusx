import { prisma } from './src/lib/prisma';

async function run() {
  const lib = await prisma.library.findFirst({ where: { librarianId: '5c4ce719-8103-41d9-96df-e58032c14a24' } });
  console.log("Library linked to Kripa:", lib);
}

run().finally(() => process.exit(0));
