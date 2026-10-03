const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const logs = await prisma.entryLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log("Recent Entry Logs:", logs);

  const relays = await prisma.relay.findMany({
    take: 5
  });
  console.log("Relays:", relays);
}
check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
