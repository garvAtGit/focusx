const { Client } = require('pg');

const client = new Client({ connectionString: 'postgresql://postgres.iiozcipbxsmjasgglsyf:0GUUxdo6XOgiQFIR@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });

client.connect().then(async () => {
    try {
        const mac = '38:3E:51:6F:ED:FC';
        const bleId = '87b99b2c-90fd-11e9-bc42-526af7764f64:1:1';

        await client.query('UPDATE "Relay" SET "bleReaderId" = $1, "macAddress" = $2 WHERE "bleReaderId" = $3 OR "macAddress" = $4', [bleId, mac, mac, mac]);
        
        console.log("Updated Relay to have correct bleReaderId and macAddress!");
    } catch (e) {
        console.error(e);
    } finally {
        client.end();
    }
});
