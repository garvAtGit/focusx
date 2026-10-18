import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.bookingIntent.update({
    where: { id: '40ef34c3-f7b5-4dea-9eda-a76c903f6de6' },
    data: { status: 'FAILED', failureReason: 'Manually cleared by admin' }
  });
  console.log('Cleared pending booking intent for Sunny Sharma');
}

main()
  .catch(console.error)
  .finally(() => {
    prisma.$disconnect();
    pool.end();
  });
