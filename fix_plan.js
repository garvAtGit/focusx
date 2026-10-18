import { Client } from 'pg';
import { v4 as uuidv4 } from 'uuid';

async function fix() {
  const connectionString = "postgresql://postgres.iiozcipbxsmjasgglsyf:0GUUxdo6XOgiQFIR@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";
  const client = new Client({ connectionString });
  
  await client.connect();
  
  const userRes = await client.query('SELECT id FROM "User" WHERE "rfidTag" = $1 LIMIT 1', ['17:77:2B:07']);
  if (userRes.rowCount === 0) return;
  const userId = userRes.rows[0].id;
  
  const libRes = await client.query('SELECT id FROM "Library" LIMIT 1');
  if (libRes.rowCount === 0) return;
  const libraryId = libRes.rows[0].id;
  
  const planRes = await client.query('SELECT id FROM "Plan" WHERE "libraryId" = $1 LIMIT 1', [libraryId]);
  let planId;
  if (planRes.rowCount === 0) {
      const newPlanId = uuidv4();
      await client.query('INSERT INTO "Plan" (id, "libraryId", name, type, "validityDays", price, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())', 
        [newPlanId, libraryId, 'Hardware Test Plan', 'FIXED', 365, 1000]);
      planId = newPlanId;
  } else {
      planId = planRes.rows[0].id;
  }
  
  const start = new Date();
  const end = new Date();
  end.setFullYear(end.getFullYear() + 1);
  const newBookingId = uuidv4();
  
  await client.query('INSERT INTO "Booking" (id, "studentId", "planId", "libraryId", status, "startTime", "endTime", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())',
    [newBookingId, userId, planId, libraryId, 'CONFIRMED', start, end]);
    
  console.log("Added active booking (plan) to user!");
  
  await client.end();
}

fix().catch(console.error);
