const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.iiozcipbxsmjasgglsyf:0GUUxdo6XOgiQFIR@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
client.connect().then(() => {
    client.query('SELECT "isPaused" FROM "Booking" WHERE id = \'f50fe3ca-66c4-456f-be4e-529a0f56f39f\'').then(res => {
        console.log(res.rows);
        client.end();
    });
});
