const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.iiozcipbxsmjasgglsyf:0GUUxdo6XOgiQFIR@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
client.connect().then(async () => {
    // 1. Move Relay to the correct library
    await client.query('UPDATE "Relay" SET "libraryId" = \'88a1c1b8-a78f-4cb1-a9a0-9f25bbbaa891\' WHERE "bleReaderId" = \'38:3E:51:6F:ED:FC\'');
    console.log("Moved Relay to Gyan Vatika Library!");
    
    // 2. Erase the hardcoded RFID tag from the test user so it shows up as "Unknown Card" again
    await client.query('UPDATE "User" SET "rfidTag" = NULL WHERE "rfidTag" IN (\'17:77:2B:07\', \'45:76:F7:06\')');
    console.log("Cleared RFID tag from test users so you can assign it in the dashboard!");
    
    client.end();
});
