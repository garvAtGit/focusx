const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.iiozcipbxsmjasgglsyf:0GUUxdo6XOgiQFIR@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

async function main() {
  await client.connect();
  const pin = '234190';
  
  // Clean up any old one
  await client.query(`DELETE FROM "HardwareClaim" WHERE "claimCode" = $1`, [pin]);
  
  // Insert
  await client.query(`
    INSERT INTO "HardwareClaim" ("id", "claimCode", "macAddress", "bleReaderId", "isClaimed", "updatedAt") 
    VALUES (gen_random_uuid(), $1, 'ESP32_TEST', 'ESP32_TEST', false, NOW())
  `, [pin]);
  
  console.log('Successfully inserted pin into raw Postgres database!');
  await client.end();
}

main().catch(console.error);
