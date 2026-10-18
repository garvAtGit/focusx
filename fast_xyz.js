const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

const client = new Client({ connectionString: 'postgresql://postgres.iiozcipbxsmjasgglsyf:0GUUxdo6XOgiQFIR@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });

client.connect().then(async () => {
    try {
        const libId = 'e83430af-7c5c-4798-ad30-ae251d45d7be'; // "xyz" library
        const rfid = '17:77:2B:07';

        // 1. Move Relay to xyz
        await client.query('UPDATE "Relay" SET "libraryId" = $1 WHERE "bleReaderId" = \'38:3E:51:6F:ED:FC\'', [libId]);
        
        // 2. Clear this RFID from any existing users to avoid unique constraint errors
        await client.query('UPDATE "User" SET "rfidTag" = NULL WHERE "rfidTag" = $1', [rfid]);
        
        // 3. Find or Create a user in the 'xyz' library
        // Wait, User doesn't have libraryId. So we just pick ANY user, or we create one and link them via Subscription/Booking.
        // Let's just find ANY user, update their RFID.
        let userId;
        const anyUserRes = await client.query('SELECT id FROM "User" LIMIT 1');
        userId = anyUserRes.rows[0].id;
        
        await client.query('UPDATE "User" SET "rfidTag" = $1 WHERE id = $2', [rfid, userId]);

        // 4. Ensure a Plan exists in xyz
        let planId;
        const planRes = await client.query('SELECT id FROM "Plan" WHERE "libraryId" = $1 LIMIT 1', [libId]);
        if (planRes.rowCount === 0) {
            planId = uuidv4();
            await client.query('INSERT INTO "Plan" (id, "libraryId", name, type, "validityDays", price, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())', 
              [planId, libId, 'Hardware Test Plan', 'FIXED', 365, 1000]);
        } else {
            planId = planRes.rows[0].id;
        }

        // 5. Create an Active Booking
        const bookingId = uuidv4();
        // Start time = yesterday to ensure it is immediately active regardless of timezones
        await client.query('INSERT INTO "Booking" (id, "studentId", "planId", "libraryId", status, "startTime", "endTime", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL \'1 day\', NOW() + INTERVAL \'1 year\', NOW(), NOW())',
          [bookingId, userId, planId, libId, 'CONFIRMED']);

        console.log("SUCCESS! Assigned to 'xyz' and activated plan.");
    } catch (e) {
        console.error(e);
    } finally {
        client.end();
    }
});
