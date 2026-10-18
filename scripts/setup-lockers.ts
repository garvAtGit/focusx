import * as dotenv from 'dotenv';
import * as path from 'path';

// Load the .env.local file to get the production DATABASE_URL
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import prisma from '../src/lib/prisma';

async function main() {
  console.log("Connecting to DB:", process.env.DATABASE_URL?.split('@')[1] || "No DB URL");
  
  const library = await prisma.library.findFirst({
    where: {
      name: {
        contains: "shanti",
        mode: "insensitive"
      }
    }
  });

  if (!library) {
    console.error("Shanti Library not found!");
    process.exit(1);
  }
  
  console.log(`Found Shanti Library: ${library.name} (ID: ${library.id})`);

  const lockersData = [];

  // 1 to 30 for Rs. 150
  for (let i = 1; i <= 30; i++) {
    lockersData.push({
      libraryId: library.id,
      name: i.toString(),
      price: 150,
    });
  }

  // 41 to 70 for Rs. 100
  for (let i = 41; i <= 70; i++) {
    lockersData.push({
      libraryId: library.id,
      name: i.toString(),
      price: 100,
    });
  }

  let updatedCount = 0;
  let createdCount = 0;

  for (const locker of lockersData) {
    const existing = await prisma.standaloneLocker.findFirst({
      where: { libraryId: library.id, name: locker.name }
    });

    if (existing) {
      await prisma.standaloneLocker.update({
        where: { id: existing.id },
        data: locker
      });
      updatedCount++;
    } else {
      await prisma.standaloneLocker.create({
        data: locker
      });
      createdCount++;
    }
  }

  console.log(`Updated ${updatedCount} lockers, Created ${createdCount} new standalone lockers for ${library.name}.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
