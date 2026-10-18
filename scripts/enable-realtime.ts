import prisma from '../src/lib/prisma';

async function main() {
  try {
    console.log("Enabling Supabase Realtime on CheckinLog table...");
    await prisma.$executeRawUnsafe(`ALTER PUBLICATION supabase_realtime ADD TABLE "CheckinLog";`);
    console.log("Successfully enabled Supabase Realtime for CheckinLog.");
  } catch (e: any) {
    if (e.message.includes('already in publication')) {
      console.log("Table CheckinLog is already in publication supabase_realtime.");
    } else {
      console.error("Error:", e);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
