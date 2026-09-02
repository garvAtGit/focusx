import prisma from './src/lib/prisma';

async function main() {
  const users = await prisma.user.findMany({
    where: { role: 'STUDENT' }
  });
  
  const notifications = users.map(u => ({
    studentId: u.id,
    title: "📱 Get the Full Experience",
    message: "Add FocusX to your Home Screen for a faster, full-screen, native app experience! [Install App](/student/dashboard?install_pwa=true)"
  }));
  
  const res = await prisma.notification.createMany({
    data: notifications
  });
  console.log(`Sent ${res.count} notifications.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
