import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const logs = await prisma.entryLog.findMany({
    orderBy: { timestamp: 'desc' },
    take: 10
  });
  console.log("Recent Entry Logs:", logs);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
