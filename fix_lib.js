const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.iiozcipbxsmjasgglsyf:0GUUxdo6XOgiQFIR@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
client.connect().then(async () => {
    const targetLibId = 'lib-e2e-1789644526093'; // Relay library
    
    // Update Booking
    await client.query('UPDATE "Booking" SET "libraryId" = $1 WHERE id = \'f50fe3ca-66c4-456f-be4e-529a0f56f39f\'', [targetLibId]);
    
    // Also update Plan just in case
    await client.query('UPDATE "Plan" SET "libraryId" = $1 WHERE name = \'Hardware Test Plan\'', [targetLibId]);
    
    console.log("Fixed library IDs to match the Door Relay!");
    client.end();
});
