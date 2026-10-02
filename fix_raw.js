import { Client } from 'pg';

async function fix() {
  const connectionString = "postgresql://postgres.iiozcipbxsmjasgglsyf:0GUUxdo6XOgiQFIR@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";
  const client = new Client({ connectionString });
  
  await client.connect();
  
  // 1. Update Relay
  const res1 = await client.query('UPDATE "Relay" SET "bleReaderId" = $1 WHERE id = (SELECT id FROM "Relay" LIMIT 1)', ['38:3E:51:6F:ED:FC']);
  console.log("Updated Relay:", res1.rowCount);
  
  // 2. Update User
  const res2 = await client.query('UPDATE "User" SET "rfidTag" = $1 WHERE id = (SELECT id FROM "User" LIMIT 1)', ['17:77:2B:07']);
  console.log("Updated User:", res2.rowCount);
  
  await client.end();
}

fix().catch(console.error);
