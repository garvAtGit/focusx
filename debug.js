const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.iiozcipbxsmjasgglsyf:0GUUxdo6XOgiQFIR@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
client.connect().then(async () => {
    const studentId = 'fa0a26a5-e64b-4a8d-90e0-2c4e1885a3cc';
    const libraryId = 'lib-e2e-1789644526093';
    
    const res = await client.query('SELECT * FROM "Booking" WHERE "studentId" = $1 AND "libraryId" = $2 AND status = \'CONFIRMED\' AND "isPaused" = false', [studentId, libraryId]);
    console.log("Bookings:", res.rows);
    
    console.log("Current DB Time:", (await client.query('SELECT NOW()')).rows[0]);
    client.end();
});
