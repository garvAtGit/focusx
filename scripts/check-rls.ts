import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const res = await prisma.$queryRaw`SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'CheckinLog'`;
  console.log(res);
}
main();
