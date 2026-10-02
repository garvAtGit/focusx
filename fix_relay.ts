import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const relay = await prisma.relay.findFirst();
  if (relay) {
      await prisma.relay.update({
          where: { id: relay.id },
          data: { bleReaderId: "38:3E:51:6F:ED:FC" }
      });
      console.log("Updated relay bleReaderId successfully!");
  } else {
      const library = await prisma.library.findFirst();
      await prisma.relay.create({
          data: {
              libraryId: library!.id,
              nfcTagId: "NFC_DUMMY_TAG_1",
              bleReaderId: "38:3E:51:6F:ED:FC",
          }
      });
      console.log("Created relay!");
  }

  let user = await prisma.user.findFirst();
  if (user) {
      await prisma.user.update({
          where: { id: user.id },
          data: { rfidTag: "17:77:2B:07" }
      });
      console.log("Assigned RFID tag!");
  }
}

main().finally(() => prisma.$disconnect());
