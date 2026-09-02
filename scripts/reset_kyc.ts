import prisma from '../src/lib/prisma';

async function main() {
  const result = await prisma.user.updateMany({
    data: {
      digilockerVerified: false,
      dob: null,
      address: null,
      gender: null,
      profilePhotoUrl: null
    }
  });
  console.log(`Reset ${result.count} users' KYC data successfully.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
