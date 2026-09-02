import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function main() {
  const result = await prisma.user.updateMany({
    where: {
      digilockerVerified: true
    },
    data: {
      digilockerVerified: false
    }
  });
  console.log(`Successfully reset digilockerVerified to false for ${result.count} users.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
