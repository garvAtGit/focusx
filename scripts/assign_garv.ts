import prisma from '../src/lib/prisma';

async function main() {
  console.log('--- 1. ASSIGNING RFID 3C986706 TO GARV ---');
  const garvUser = await prisma.user.update({
    where: { id: 'c481002f-b52e-4c9b-b5bf-1606d9df178d' },
    data: { rfidTag: '3C986706' }
  });
  console.log(`Updated Garv (+917409757395): ID ${garvUser.id}, rfidTag: ${garvUser.rfidTag}`);

  // Also update second Garv record if exists
  try {
    await prisma.user.update({
      where: { id: '669671f5-18b3-40c0-9057-d13a6d0cb504' },
      data: { rfidTag: '3C986706' }
    });
    console.log('Updated secondary Garv record as well');
  } catch (e) {
    console.log('Secondary record not updated:', e);
  }

  console.log('\n--- 2. UPDATING RELAY DEVICE SECRET ---');
  const relay = await prisma.relay.update({
    where: { id: '90c825cd-920c-477f-8dbc-cf59b823f3b7' },
    data: {
      deviceSecret: 'a1b2c3d4e5f6789012345678abcdef01',
      status: 'ONLINE',
      lastSeenAt: new Date()
    }
  });
  console.log(`Relay updated: ${relay.id}, bleReaderId: ${relay.bleReaderId}, deviceSecret: ${relay.deviceSecret}`);

  console.log('\n--- 3. INCREMENTING KRIPA LIBRARY AUTH REVISION ---');
  const lib = await prisma.library.update({
    where: { id: 'f6cd1770-e936-4457-b2ef-bf17bce9f730' },
    data: { authRevision: { increment: 1 } }
  });
  console.log(`Kripa Library new authRevision: ${lib.authRevision}`);
}

main()
  .catch((err) => {
    console.error('Error in script:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
