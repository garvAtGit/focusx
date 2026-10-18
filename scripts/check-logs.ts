import prisma from '../src/lib/prisma';

async function main() {
  console.log('--- EntryLogs (Hardware) ---');
  const entries = await prisma.entryLog.findMany({orderBy: {timestamp: 'desc'}, take: 2});
  console.log(entries);

  console.log('--- CheckinLogs (Realtime trigger) ---');
  const checkins = await prisma.checkinLog.findMany({orderBy: {timestamp: 'desc'}, take: 2});
  console.log(checkins);
}
main();
