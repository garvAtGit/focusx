const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.iiozcipbxsmjasgglsyf:0GUUxdo6XOgiQFIR@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
client.connect().then(async () => {
    const res = await client.query('SELECT id, name FROM "Library"');
    console.log("Libraries:", res.rows);
    client.end();
});
