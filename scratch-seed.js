const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  const user = await prisma.user.create({
    data: {
      authId: "local_test_user",
      email: "test@example.com",
      name: "Test User",
      role: "STUDENT",
      uniqueId: "TST-1234",
    }
  });

  const library = await prisma.library.create({
    data: {
      name: "Test Lib",
      city: "Test",
      locality: "Test",
      address: "123 Test",
      description: "Test",
      contactPhone: "123",
      contactEmail: "testlib@example.com",
      openingTime: "08:00",
      closingTime: "22:00",
      lat: 1,
      lng: 1,
      status: "PUBLISHED"
    }
  });

  const plan = await prisma.plan.create({
    data: {
      libraryId: library.id,
      name: "Test Plan",
      type: "FLEXIBLE",
      price: 500,
      validityDays: 30,
      status: "ACTIVE"
    }
  });

  const now = new Date();
  const later = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);

  await prisma.booking.create({
    data: {
      studentId: user.id,
      libraryId: library.id,
      planId: plan.id,
      status: "PENDING_PAYMENT",
      paymentRef: "test-ref",
      startTime: now,
      endTime: later
    }
  });

  console.log("Seeded successfully. UserId:", user.id);
}

seed().catch(console.error).finally(() => prisma.$disconnect());
