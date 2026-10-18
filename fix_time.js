const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.iiozcipbxsmjasgglsyf:0GUUxdo6XOgiQFIR@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
client.connect().then(async () => {
    await client.query('UPDATE "Booking" SET "startTime" = NOW() - INTERVAL \'1 day\' WHERE id = \'f50fe3ca-66c4-456f-be4e-529a0f56f39f\'');
    console.log("Fixed startTime to be in the past!");
    client.end();
});
