import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function main() {
  await prisma.booking.deleteMany({
    where: {
      id: {
        in: [
          'ebca15fc-702a-48dd-8538-86d141ca45f0', // Duplicate from June 10
          'da0ad0d7-26e5-4ba0-afff-18cd85caa086'  // My duplicate from July 23
        ]
      }
    }
  });
  console.log('Deleted duplicate bookings');
}
main().catch(console.error).finally(() => prisma.$disconnect());
