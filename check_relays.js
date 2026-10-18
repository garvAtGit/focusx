const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const relays = await prisma.relay.findMany({
    take: 10
  });
  console.log("Relays in DB:", JSON.stringify(relays, null, 2));
}
check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
