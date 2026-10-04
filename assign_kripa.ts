import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const kripa = await prisma.library.findFirst({
    where: { name: { contains: 'Kripa' } }
  });

  if (!kripa) {
    console.log("Kripa Library not found!");
    return;
  }

  console.log("Found Kripa Library:", kripa.id);

  // Look for existing relay or create one
  let relay = await prisma.relay.findFirst({
    where: { libraryId: kripa.id }
  });

  const READER_ID = "87b99b2c-90fd-11e9-bc42-526af7764f64:1:1";

  if (relay) {
    console.log("Updating existing relay:", relay.id);
    relay = await prisma.relay.update({
      where: { id: relay.id },
      data: {
        macAddress: READER_ID,
        bleReaderId: READER_ID
      }
    });
  } else {
    console.log("Creating new relay for Kripa Library");
    relay = await prisma.relay.create({
      data: {
        libraryId: kripa.id,
        nfcTagId: "NFC_" + Math.random().toString(36).substring(7),
        macAddress: READER_ID,
        bleReaderId: READER_ID,
        status: "ONLINE"
      }
    });
  }

  console.log("Successfully linked machine to Kripa Library!");
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
