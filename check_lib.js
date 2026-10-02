const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.iiozcipbxsmjasgglsyf:0GUUxdo6XOgiQFIR@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
client.connect().then(async () => {
    const relayRes = await client.query('SELECT "libraryId" FROM "Relay" WHERE "bleReaderId" = \'38:3E:51:6F:ED:FC\'');
    console.log("Relay libraryId:", relayRes.rows[0].libraryId);
    
    const bookingRes = await client.query('SELECT "libraryId" FROM "Booking" WHERE id = \'f50fe3ca-66c4-456f-be4e-529a0f56f39f\'');
    console.log("Booking libraryId:", bookingRes.rows[0].libraryId);
    
    client.end();
});
