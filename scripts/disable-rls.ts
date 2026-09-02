import prisma from '../src/lib/prisma';

async function main() {
  try {
    console.log("Disabling RLS on CheckinLog table...");
    await prisma.$executeRawUnsafe(`ALTER TABLE "CheckinLog" DISABLE ROW LEVEL SECURITY;`);
    console.log("Successfully disabled RLS for CheckinLog.");
  } catch (e: any) {
    console.error("Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
