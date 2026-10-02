const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.iiozcipbxsmjasgglsyf:0GUUxdo6XOgiQFIR@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
client.connect().then(() => {
    client.query('SELECT id, "studentId", "startTime", "endTime", status FROM "Booking" ORDER BY "createdAt" DESC LIMIT 1').then(res => {
        console.log(res.rows);
        client.end();
    });
});
