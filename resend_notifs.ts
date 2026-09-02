import 'dotenv/config';
import prisma from './src/lib/prisma';

async function run() {
  await prisma.notification.deleteMany({where:{title:'Welcome to Library Near!'}});
  const users = await prisma.user.findMany({select:{id:true}});
  let count=0;
  for(const u of users) {
    await prisma.notification.create({
      data:{
        studentId: u.id,
        title: 'Welcome to Library Near!',
        message: 'Your account has been created successfully. Book a seat or explore library plans in your area.',
        type: 'SYSTEM',
        actionUrl: '/libraries'
      }
    });
    count++;
  }
  console.log('Sent ' + count);
}
run().catch(console.error).finally(() => prisma.$disconnect());
