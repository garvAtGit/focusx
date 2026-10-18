import dotenv from 'dotenv';
dotenv.config();
process.env.DATABASE_URL = process.env.DIRECT_URL;

import prisma from '../src/lib/prisma';

async function main() {
  const users = await prisma.user.findMany({
    where: {
      name: {
        contains: 'sadhna',
        mode: 'insensitive'
      }
    },
    include: {
      bookings: true
    }
  });

  console.log(JSON.stringify(users, null, 2));
}
main();
