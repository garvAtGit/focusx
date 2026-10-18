require('dotenv').config({ path: '.env.production.local' });
const { Client } = require('pg');

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    
    // Check if the Relay exists
    const relays = await client.query('SELECT * FROM "Relay" ORDER BY "createdAt" DESC LIMIT 5');
    console.log("Recent Relays:", relays.rows);
    
    // Check EntryLogs
    const logs = await client.query('SELECT * FROM "EntryLog" ORDER BY "timestamp" DESC LIMIT 5');
    console.log("Recent EntryLogs:", logs.rows);

  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    await client.end();
  }
}

check();
