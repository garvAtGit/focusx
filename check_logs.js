require('dotenv').config({ path: '.env.production.local' });
const { Client } = require('pg');

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    const res = await client.query('SELECT * FROM "EntryLog" ORDER BY "createdAt" DESC LIMIT 5');
    console.log("Recent EntryLogs:", res.rows);
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    await client.end();
  }
}

check();
