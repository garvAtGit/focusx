import prisma from '../src/lib/prisma';
async function main() {
  const logs = await prisma.entryLog.findMany({orderBy: {timestamp: 'desc'}, take: 5});
  console.log(logs);
}
main();
