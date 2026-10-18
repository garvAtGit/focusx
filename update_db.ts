import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.relay.updateMany({
    where: { macAddress: "000000000000" },
    data: { bleReaderId: "87b99b2c-90fd-11e9-bc42-526af7764f64:1:1" }
  });
  console.log(result);
}

main().finally(() => prisma.$disconnect());
