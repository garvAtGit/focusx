import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const kripa = await prisma.library.findFirst({
    where: { name: { contains: 'Kripa' } }
  });

  if (!kripa) {
    console.log("Kripa Library not found!");
    return;
  }

  const READER_ID = "87b99b2c-90fd-11e9-bc42-526af7764f64:1:1";

  // First, find and clear the old owner
  const oldOwner = await prisma.relay.findFirst({
    where: { bleReaderId: READER_ID }
  });
  
  if (oldOwner) {
    console.log("Clearing reader ID from previous owner relay:", oldOwner.id);
    await prisma.relay.update({
      where: { id: oldOwner.id },
      data: {
        macAddress: null,
        bleReaderId: null
      }
    });
  }

  let relay = await prisma.relay.findFirst({
    where: { libraryId: kripa.id }
  });

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
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
