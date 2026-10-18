import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient(); // DATABASE_URL is already in process.env

  const studentId = '8af987b8-49ef-441a-b2dd-bf137a0dc5b8';
  const bookings = await prisma.booking.findMany({
    where: { studentId },
    include: { student: true, plan: true }
  });
  console.log(JSON.stringify(bookings, null, 2));
  
  await prisma.$disconnect();
}

main().catch(e => console.error(e));
