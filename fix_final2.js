const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.iiozcipbxsmjasgglsyf:0GUUxdo6XOgiQFIR@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
client.connect().then(async () => {
    try {
        const targetLibId = 'e83430af-7c5c-4798-ad30-ae251d45d7be'; // xyz library
        
        // 1. Delete the dummy relay-e2e
        await client.query('DELETE FROM "Relay" WHERE id = \'relay-e2e\'');
        
        // 2. Update the real Relay to have the MAC address and point to xyz
        await client.query('UPDATE "Relay" SET "macAddress" = \'38:3E:51:6F:ED:FC\', "libraryId" = $1 WHERE id = \'b018a625-0a12-44a0-98b1-745a99a3d0d8\'', [targetLibId]);
        
        console.log("Fixed Relays!");
    } catch (e) {
        console.error(e);
    } finally {
        client.end();
    }
});
