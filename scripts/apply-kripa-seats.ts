import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import type { Prisma } from '@prisma/client';
import prisma from '../src/lib/prisma';

async function generateSeats() {
  const library = await prisma.library.findFirst({
    where: { name: 'Kripa Library' }
  });

  if (!library) {
    console.error("Kripa Library not found. Have you run seed-kripa.ts?");
    process.exit(1);
  }

  // 1. Clear existing seats and lockers for Kripa
  await prisma.seat.deleteMany({ where: { libraryId: library.id } });
  await prisma.standaloneLocker.deleteMany({ where: { libraryId: library.id } });

  console.log("Cleared existing seats and lockers.");

  // 2. Generate new seats based on layout
  const seatsData: Prisma.SeatUncheckedCreateInput[] = [];
  
  const generateBlock = (prefix: string, count: number, hasLocker = false, lockerPrice: number | null = null) => {
    for (let i = 1; i <= count; i++) {
      seatsData.push({
        libraryId: library.id,
        name: `${prefix}${i}`,
        type: 'NORMAL',
        gridX: i - 1,
        gridY: prefix.charCodeAt(0) - 65,
        hasLocker: hasLocker,
        lockerPriceDaily: hasLocker ? lockerPrice : null,
      });
    }
  };

  // Image 1
  generateBlock('A', 4);
  generateBlock('B', 10);
  generateBlock('C', 5);
  generateBlock('D', 10);
  generateBlock('E', 10, true, 100);

  // Image 2
  generateBlock('F', 9);
  generateBlock('G', 10);
  generateBlock('H', 9);
  generateBlock('I', 8);

  // Image 3
  generateBlock('J', 6);
  generateBlock('K', 6);
  generateBlock('L', 6);

  // Image 4 & 5
  generateBlock('M', 6, true, 100);
  generateBlock('N', 8);
  generateBlock('O', 8);
  generateBlock('P', 8);
  
  // Q & R are also "seats with lockers" as per user confirmation
  generateBlock('Q', 8, true, 200);
  
  generateBlock('R', 2, true, 100); // R1, R2 -> 100
  // R3, R4 -> 200
  seatsData.push({ libraryId: library.id, name: 'R3', type: 'NORMAL', gridX: 2, gridY: 17, hasLocker: true, lockerPriceDaily: 200 });
  seatsData.push({ libraryId: library.id, name: 'R4', type: 'NORMAL', gridX: 3, gridY: 17, hasLocker: true, lockerPriceDaily: 200 });

  generateBlock('S', 6);
  generateBlock('T', 6);
  generateBlock('U', 6);
  generateBlock('V', 6);

  await prisma.seat.createMany({ data: seatsData });
  console.log(`Created ${seatsData.length} seats.`);

  // 3. Generate 100 standalone lockers (Rs 100 each)
  const standaloneLockers = [];
  for (let i = 1; i <= 100; i++) {
    standaloneLockers.push({
      libraryId: library.id,
      name: `Locker ${i}`,
      price: 100,
    });
  }

  await prisma.standaloneLocker.createMany({ data: standaloneLockers });
  console.log(`Created 100 standalone lockers.`);

  // 4. Update the library to use compactSeatMap if it's not already
  await prisma.library.update({
    where: { id: library.id },
    data: {
      compactSeatMap: true,
      seatsAvailable: seatsData.length,
    }
  });

  console.log("Successfully seeded Kripa Library with exact seat layout and standalone lockers!");
}

generateSeats()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
