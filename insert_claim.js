const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const pin = "234190";
  // Insert the pin manually so the user can test the UI flow immediately
  const claim = await prisma.hardwareClaim.upsert({
    where: { claimCode: pin },
    update: { macAddress: "TEST_MAC", isClaimed: false },
    create: { claimCode: pin, macAddress: "TEST_MAC", isClaimed: false }
  });
  console.log("Inserted:", claim);
}

main().catch(e => {
  console.error(e);
}).finally(() => {
  prisma.$disconnect();
});
