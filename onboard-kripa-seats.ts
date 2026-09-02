// @ts-nocheck
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("Starting Kripa Library Seat Map Update...");

  // 1. Find Kripa Library
  const kripaLibrary = await prisma.library.findFirst({
    where: { name: 'Kripa Library' }
  });

  if (!kripaLibrary) {
    console.error("Kripa Library not found! Make sure it is seeded first.");
    process.exit(1);
  }

  console.log(`Found Kripa Library with ID: ${kripaLibrary.id}`);

  // 2. Rank Kripa First & Enable Compact Seat Map
  await prisma.library.update({
    where: { id: kripaLibrary.id },
    data: {
      createdAt: new Date('2030-01-01T00:00:00.000Z'), // Rank 1
      compactSeatMap: true
    }
  });
  console.log("Updated Kripa Library to rank first and enabled compactSeatMap.");

  // 3. Clear existing seats and standalone lockers
  await prisma.seat.deleteMany({
    where: { libraryId: kripaLibrary.id }
  });
  await prisma.standaloneLocker.deleteMany({
    where: { libraryId: kripaLibrary.id }
  });
  console.log("Cleared existing seats and standalone lockers.");

  // 4. Define Seat Arrays
  const generateRange = (prefix: string, start: number, end: number) => {
    return Array.from({ length: end - start + 1 }, (_, i) => `${prefix}${start + i}`);
  };

  const normalSeatNames = [
    ...generateRange('A', 1, 4),
    ...generateRange('B', 1, 10),
    ...generateRange('C', 1, 8),
    ...generateRange('D', 1, 10),
    ...generateRange('F', 1, 9),
    ...generateRange('G', 1, 10),
    ...generateRange('H', 1, 9),
    ...generateRange('I', 1, 8),
    ...generateRange('J', 1, 6),
    ...generateRange('K', 1, 6),
    ...generateRange('L', 1, 6),
    ...generateRange('N', 1, 8),
    ...generateRange('O', 1, 8),
    ...generateRange('P', 1, 8),
    ...generateRange('S', 1, 6),
    ...generateRange('T', 1, 6),
    ...generateRange('U', 1, 6),
    ...generateRange('V', 1, 6),
  ];

  const seatsWith100RsLockers = [
    ...generateRange('E', 1, 10),
    ...generateRange('M', 1, 6),
    'R1', 'R2'
  ];

  const standaloneLockers200Rs = [
    ...generateRange('Q', 1, 8),
    'R3', 'R4'
  ];

  // 5. Insert Seats
  const seatsToInsert = [
    ...normalSeatNames.map(name => ({
      libraryId: kripaLibrary.id,
      name,
      type: 'NORMAL' as const,
      gridX: 0,
      gridY: 0,
      hasLocker: false,
      lockerPriceMonthly: null,
    })),
    ...seatsWith100RsLockers.map(name => ({
      libraryId: kripaLibrary.id,
      name,
      type: 'NORMAL' as const,
      gridX: 0,
      gridY: 0,
      hasLocker: true,
      lockerPriceMonthly: 100,
    }))
  ];

  await prisma.seat.createMany({
    data: seatsToInsert
  });
  console.log(`Inserted ${seatsToInsert.length} total seats.`);

  // 6. Insert Standalone Lockers sequentially so order is preserved
  console.log("Inserting Standalone Lockers...");
  for (let i = 0; i < standaloneLockers200Rs.length; i++) {
    const name = standaloneLockers200Rs[i];
    // Slightly adjust creation time so they are ordered correctly 
    // (We want the newest at the top, so latest created should be Q8. Wait, if Q1 is created first, it's older. So Q8 will be at the top. This is fine.)
    const creationTime = new Date(Date.now() + i * 1000); 
    await prisma.standaloneLocker.create({
      data: {
        libraryId: kripaLibrary.id,
        name,
        price: 200,
        createdAt: creationTime
      }
    });
  }
  console.log(`Inserted ${standaloneLockers200Rs.length} Standalone Lockers.`);

  console.log("Kripa Library Onboarding Complete!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
