import { Client } from 'pg';

async function fix() {
  const connectionString = "postgresql://postgres.iiozcipbxsmjasgglsyf:0GUUxdo6XOgiQFIR@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";
  const client = new Client({ connectionString });
  
  await client.connect();
  
  // 1. Get the user ID
  const userRes = await client.query('SELECT id, "libraryId" FROM "User" WHERE "rfidTag" = $1 LIMIT 1', ['17:77:2B:07']);
  if (userRes.rowCount === 0) {
      console.log("User not found!");
      return;
  }
  const userId = userRes.rows[0].id;
  const libraryId = userRes.rows[0].libraryId;
  
  // 2. Insert a dummy active subscription
  // We will just create a plan first, or just insert a Subscription
  const planRes = await client.query('SELECT id FROM "Plan" WHERE "libraryId" = $1 LIMIT 1', [libraryId]);
  let planId;
  if (planRes.rowCount === 0) {
      // Create a dummy plan
      const insertPlan = await client.query('INSERT INTO "Plan" ("libraryId", name, price, type, "billingCycle", status, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING id', 
        [libraryId, 'Hardware Test Plan', 1000, 'FIXED', 'MONTHLY', 'ACTIVE']);
      planId = insertPlan.rows[0].id;
  } else {
      planId = planRes.rows[0].id;
  }
  
  // Create subscription
  const start = new Date();
  const end = new Date();
  end.setFullYear(end.getFullYear() + 1);
  
  await client.query('INSERT INTO "Subscription" ("studentId", "planId", "libraryId", status, "startDate", "endDate", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())',
    [userId, planId, libraryId, 'ACTIVE', start, end]);
    
  console.log("Added active subscription to user!");
  
  await client.end();
}

fix().catch(console.error);
