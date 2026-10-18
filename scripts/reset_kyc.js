const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.updateMany({
    data: {
      digilockerVerified: false,
      name: null,
      dob: null,
      address: null,
      gender: null,
      profilePhotoUrl: null
    }
  });
  console.log(`Reset ${result.count} users' KYC data successfully.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
