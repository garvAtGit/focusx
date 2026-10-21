import prisma from '../src/lib/prisma';

async function main() {
  console.log('Searching for Garv...');
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: 'Garv', mode: 'insensitive' } },
        { phone: { contains: '7409757395' } }
      ]
    },
    include: {
      bookings: {
        include: { library: true }
      }
    }
  });

  console.log(`Found ${users.length} user(s):`);
  for (const u of users) {
    console.log(`User: ${u.name} | Phone: ${u.phone} | ID: ${u.id} | RFID: '${u.rfidTag}'`);
    console.log(`  Bookings count: ${u.bookings.length}`);
    for (const b of u.bookings) {
      console.log(`    Booking ID: ${b.id} | Lib: ${b.library?.name} (${b.libraryId}) | Status: ${b.status} | End: ${b.endTime}`);
    }
  }

  // Also check if there's any booking in Kripa Library with phone or name containing Garv
  const kripaBookings = await prisma.booking.findMany({
    where: {
      libraryId: 'f6cd1770-e936-4457-b2ef-bf17bce9f730',
      status: 'CONFIRMED'
    },
    include: { student: true },
    take: 10
  });
  console.log(`\nSample active bookings in Kripa Library (${kripaBookings.length} sampled):`);
  for (const b of kripaBookings) {
    console.log(`  Student: ${b.student?.name} (${b.student?.phone}) | RFID: ${b.student?.rfidTag} | End: ${b.endTime}`);
  }
}

main()
  .catch((err) => {
    console.error('Error in script:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
