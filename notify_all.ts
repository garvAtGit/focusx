import prisma from './src/lib/prisma';

async function main() {
  console.log("Fetching all students...");
  const students = await prisma.user.findMany({
    select: { id: true, role: true, name: true, phone: true }
  });
  
  console.log(`Found ${students.length} students. Creating notifications...`);
  
  let created = 0;
  for (const student of students) {
    // Check if they already received a welcome notification today
    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);
    const existing = await prisma.notification.findFirst({
      where: {
        studentId: student.id,
        title: 'Welcome to the Notification Center! 🔔',
        createdAt: { gte: startOfDay }
      }
    });

    if (!existing) {
      await prisma.notification.create({
        data: {
          studentId: student.id,
          title: 'Welcome to the Notification Center! 🔔',
          message: 'This is the new notification center. You will receive important updates about your plan, renewals, and library alerts right here from now on!',
        }
      });
      created++;
    }
  }
  
  console.log(`Successfully created ${created} notifications.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
