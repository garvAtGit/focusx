import 'dotenv/config'
import prisma from './src/lib/prisma'

async function main() {
  console.log("Starting seed...")
  
  // 1. Create a dummy librarian if not exists
  let librarian = await prisma.user.findFirst({ where: { role: 'LIBRARIAN' } });
  if (!librarian) {
    librarian = await prisma.user.create({
      data: {
        email: "librarian@FocusX.com",
        name: "Admin Librarian",
        role: "LIBRARIAN",
        uniqueId: "LIB001"
      }
    });
  }

  // 2. Create a few libraries
  const libraryNames = ["Central Library", "Quiet Space Hub", "Study Sphere"];
  for (const name of libraryNames) {
    const lib = await prisma.library.findFirst({ where: { name } });
    if (!lib) {
      await prisma.library.create({
        data: {
          name,
          address: "123 Main St, Tech City",
          managerName: "Manager " + name,
          managerPhone: "+1234567890",
          librarianId: librarian.id,
          facilities: ["AC", "Wi-Fi", "RO Water"],
          seats: {
            create: Array.from({ length: 20 }, (_, i) => ({
              name: `A${i+1}`,
              type: 'NORMAL',
              gridX: i % 5,
              gridY: Math.floor(i / 5),
            }))
          },
          plans: {
            create: [
              { name: "Daily Pass", type: "FIXED", price: 99, validityDays: 1 },
              { name: "Monthly Elite", type: "FLEXIBLE", price: 1499, validityDays: 30, discount: 10 }
            ]
          }
        }
      });
      console.log(`Created Library: ${name}`);
    }
  }

  // 3. Create a few dummy students
  const studentNames = ["Alice Smith", "Bob Johnson", "Charlie Davis"];
  const studentList = [];
  for (const name of studentNames) {
    const email = name.toLowerCase().replace(' ', '.') + "@example.com";
    let student = await prisma.user.findUnique({ where: { email } });
    if (!student) {
      student = await prisma.user.create({
        data: {
          name,
          email,
          role: "STUDENT",
          phone: "+9876543210",
          uniqueId: Math.random().toString(36).substring(2, 8).toUpperCase()
        }
      });
      console.log(`Created Student: ${name}`);
    }
    studentList.push(student);
  }

  // 4. Create some test bookings for the first library
  const firstLib = await prisma.library.findFirst({ include: { seats: true, plans: true } });
  if (firstLib && studentList.length > 0) {
    const existingBookings = await prisma.booking.count();
    if (existingBookings === 0) {
      for (let i = 0; i < studentList.length; i++) {
        await prisma.booking.create({
          data: {
            studentId: studentList[i].id,
            libraryId: firstLib.id,
            seatId: firstLib.seats[i].id,
            planId: firstLib.plans[0].id,
            startTime: new Date(),
            endTime: new Date(new Date().setDate(new Date().getDate() + 1)), // +1 day
            status: "CONFIRMED"
          }
        });
      }
      console.log("Created test bookings.");
    }
  }

  console.log("Seeding complete!");
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
