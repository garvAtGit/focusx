import { config } from 'dotenv';
config({ path: '.env.local' });
import prisma from './src/lib/prisma';

async function main() {
  const latestWelcome = await prisma.notification.findFirst({
    where: {
      title: {
        contains: "Welcome",
        mode: "insensitive"
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  console.log("Latest welcome notification:", latestWelcome);

  if (latestWelcome) {
    const deleted = await prisma.notification.deleteMany({
      where: {
        title: latestWelcome.title
      }
    });
    console.log(`Deleted ${deleted.count} old welcome notifications`);

    const users = await prisma.user.findMany({ select: { id: true, role: true } });
    console.log(`Found ${users.length} users. Creating new notifications...`);

    const notificationsToCreate = users.map(user => ({
      studentId: user.id,
      title: latestWelcome.title,
      message: latestWelcome.message,
      type: latestWelcome.type,
      actionUrl: latestWelcome.actionUrl,
      actionLabel: latestWelcome.actionLabel,
      isRead: false
    }));

    const created = await prisma.notification.createMany({
      data: notificationsToCreate
    });
    console.log(`Created ${created.count} new welcome notifications.`);
  } else {
    console.log("No welcome notification found to clone.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
