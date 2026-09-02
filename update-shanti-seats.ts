// @ts-nocheck
import 'dotenv/config';
import { PrismaClient, SeatType, type Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Searching for Shanti Library...");
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

  console.log(`Found Library: ${library.name} (ID: ${library.id})`);

  // We will structure the seats in a 10-column grid
  const COLS = 10;
  let currentIndex = 0; // To track grid position

  const seatsData: Prisma.SeatUncheckedCreateInput[] = [];

  // 1 to 87: Reservable (NORMAL)
  for (let i = 1; i <= 87; i++) {
    seatsData.push({
      libraryId: library.id,
      name: i.toString(),
      type: SeatType.NORMAL,
      gridX: currentIndex % COLS,
      gridY: Math.floor(currentIndex / COLS),
      hasLocker: false,
      lockerPriceMonthly: null,
      premiumPriceMonthly: null,
      syncPremiumOffers: true,
    });
    currentIndex++;
  }

  // 101 to 119: Premium with 200 extra charge and locker of price 100
  for (let i = 101; i <= 119; i++) {
    seatsData.push({
      libraryId: library.id,
      name: i.toString(),
      type: SeatType.PREMIUM,
      gridX: currentIndex % COLS,
      gridY: Math.floor(currentIndex / COLS),
      hasLocker: true,
      lockerPriceMonthly: 100,
      premiumPriceMonthly: 200,
      syncPremiumOffers: true,
    });
    currentIndex++;
  }

  // 120 to 143: Premium with 300 extra charge and no locker
  for (let i = 120; i <= 143; i++) {
    seatsData.push({
      libraryId: library.id,
      name: i.toString(),
      type: SeatType.PREMIUM,
      gridX: currentIndex % COLS,
      gridY: Math.floor(currentIndex / COLS),
      hasLocker: false,
      lockerPriceMonthly: null,
      premiumPriceMonthly: 300,
      syncPremiumOffers: true,
    });
    currentIndex++;
  }

  console.log(`Prepared ${seatsData.length} seats. Upserting to database...`);

  let updatedCount = 0;
  let createdCount = 0;

  for (const seat of seatsData) {
    const existing = await prisma.seat.findFirst({
      where: { libraryId: library.id, name: seat.name }
    });

    if (existing) {
      await prisma.seat.update({
        where: { id: existing.id },
        data: seat
      });
      updatedCount++;
    } else {
      await prisma.seat.create({
        data: seat
      });
      createdCount++;
    }
  }

  // Also enable compact mode and NUMERIC naming to make it look clean
  await prisma.library.update({
    where: { id: library.id },
    data: { 
      compactSeatMap: true,
      seatNaming: "NUMERIC"
    }
  });

  console.log(`Success! Updated ${updatedCount} seats, Created ${createdCount} new seats for ${library.name}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
