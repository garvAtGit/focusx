import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = "postgresql://postgres.iiozcipbxsmjasgglsyf:0GUUxdo6XOgiQFIR@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function test() {
    const studentId = 'fa0a26a5-e64b-4a8d-90e0-2c4e1885a3cc';
    const libraryId = 'lib-e2e-1789644526093';
    const now = new Date();
    
    console.log("Searching for:", {studentId, libraryId, now});
    
    const activeBooking = await prisma.booking.findFirst({
      where: {
        studentId,
        libraryId,
        status: "CONFIRMED",
        startTime: { lte: now },
        endTime: { gte: now },
        isPaused: false
      }
    });
    
    console.log("Result:", activeBooking);
    
    if (!activeBooking) {
        // Find ANY booking for this user
        const any = await prisma.booking.findMany({ where: { studentId }});
        console.log("All bookings for user:", any);
    }
}

test().finally(() => prisma.$disconnect());
