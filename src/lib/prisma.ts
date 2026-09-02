import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import dns from 'dns'

// Force IPv4 resolution for Supabase pooler on Vercel to prevent ENETUNREACH
dns.setDefaultResultOrder('ipv4first')

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pool: Pool | undefined
}

let connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

// Vercel build containers often block or fail to route to pooler ports (6543) via IPv6.
// By using DIRECT_URL (5432) during the CI build phase, we bypass the ENETUNREACH errors.
if (process.env.CI && process.env.DIRECT_URL) {
  connectionString = process.env.DIRECT_URL;
}

if (!connectionString) {
  throw new Error(
    'Missing DATABASE_URL or DIRECT_URL environment variable. ' +
    'Database connection cannot be established.',
  );
}

const pool = globalForPrisma.pool ?? new Pool({ 
  connectionString,
  max: 3, // Keep max connections low per serverless instance
  idleTimeoutMillis: 10000 
})
const adapter = new PrismaPg(pool)

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

globalForPrisma.prisma = prisma
globalForPrisma.pool = pool

export default prisma
