import { PrismaClient, Role, SeatType, PlanType, BookingStatus, QueryType } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import "dotenv/config";

const connectionString = `${process.env.DATABASE_URL}`
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding data...')

  // 1. Create a Librarian
  const librarian = await prisma.user.create({
    data: {
      authId: 'mock-auth-id-1',
      role: Role.LIBRARIAN,
      email: 'librarian@example.com',
      name: 'Sarah The Librarian',
      phone: '+1234567890',
      uniqueId: 'LIB001'
    }
  })

  // 2. Create a Student
  const student = await prisma.user.create({
    data: {
      authId: 'mock-auth-id-2',
      role: Role.STUDENT,
      email: 'student@example.com',
      name: 'John Student',
      phone: '+0987654321',
      uniqueId: 'STU001'
    }
  })

  // 3. Create Libraries
  const library1 = await prisma.library.create({
    data: {
      librarianId: librarian.id,
      name: 'Central City Library',
      address: 'Downtown Metro Station, 1st Ave',
      facilities: ['AC', 'High-Speed WiFi', 'Cafeteria', 'Lockers', 'Silent Zone'],
      managerName: 'Alex Johnson',
      managerPhone: '+1 234 567 8900'
    }
  })

  await prisma.library.create({
    data: {
      librarianId: librarian.id,
      name: 'Quiet Hub',
      address: 'North Avenue, Near University',
      facilities: ['AC', 'Silent Zone', 'Lockers'],
      managerName: 'Mike Ross',
      managerPhone: '+1 333 444 5555'
    }
  })

  // 4. Create Plans for Library 1
  const plan1 = await prisma.plan.create({
    data: {
      libraryId: library1.id,
      name: 'Daily Fixed',
      type: PlanType.FIXED,
      validityDays: 1,
      price: 5.0
    }
  })

  await prisma.plan.create({
    data: {
      libraryId: library1.id,
      name: 'Monthly Fixed',
      type: PlanType.FIXED,
      validityDays: 30,
      price: 120.0
    }
  })

  // 5. Create Seats for Library 1
  const seatsData = []
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 8; x++) {
      const isReserved = (x === 2 && y === 1) || (x === 4 && y === 3)
      const isNonReservable = (x === 7)
      
      seatsData.push({
        libraryId: library1.id,
        name: `${String.fromCharCode(65 + y)}${x + 1}`,
        type: isReserved ? SeatType.RESERVED : (isNonReservable ? SeatType.NON_RESERVABLE : SeatType.NORMAL),
        gridX: x,
        gridY: y
      })
    }
  }
  await prisma.seat.createMany({ data: seatsData })
  
  const createdSeats = await prisma.seat.findMany({ where: { libraryId: library1.id } })

  // 6. Create a Booking
  await prisma.booking.create({
    data: {
      studentId: student.id,
      libraryId: library1.id,
      seatId: createdSeats[0].id,
      planId: plan1.id,
      startTime: new Date(),
      endTime: new Date(Date.now() + 86400000), // +1 day
      status: BookingStatus.CONFIRMED,
      paymentRef: 'mock_razorpay_id'
    }
  })

  // 7. Create a Query
  await prisma.query.create({
    data: {
      type: QueryType.REVIEW,
      content: 'Excellent environment, really helped me focus for my exams!',
      rating: 5,
      studentId: student.id,
      libraryId: library1.id
    }
  })

  console.log('Seeding finished.')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
