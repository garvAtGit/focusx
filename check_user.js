const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.iiozcipbxsmjasgglsyf:0GUUxdo6XOgiQFIR@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
client.connect().then(async () => {
    const userRes = await client.query('SELECT id FROM "User" WHERE "rfidTag" = $1 LIMIT 1', ['17:77:2B:07']);
    console.log("User id for RFID:", userRes.rows[0].id);
    client.end();
});
