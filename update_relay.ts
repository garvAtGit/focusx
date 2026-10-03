import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const relay = await prisma.relay.findFirst({
    where: { bleReaderId: '87b99b2c-90fd-11e9-bc42-526af7764f64:1:1' }
  });

  if (relay) {
    console.log("Found relay, updating...");
    await prisma.relay.update({
      where: { id: relay.id },
      data: {
        bleReaderId: 'ffffff87ffffffb9ffffff9b2c-ffffff90fffffffd-11ffffffe9-ffffffbc42-526afffffff7764f64:1:1',
        macAddress: '87b99b2c-90fd-11e9-bc42-526af7764f64:1:1' // Keep the correct one in macAddress so hardware scan still works
      }
    });
    console.log("Updated!");
  } else {
    console.log("Relay not found.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
