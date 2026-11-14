import assert from 'node:assert/strict';import test from 'node:test';import {readFileSync} from 'node:fs';import {Client} from 'pg';
test('pause history migration preserves existing bookings and seeds only known events',{skip:!process.env.TEST_DATABASE_URL},async()=>{
const db=new Client({connectionString:process.env.TEST_DATABASE_URL});await db.connect();
const schema='qa_migration_'+crypto.randomUUID().replaceAll('-','');
try{await db.query('BEGIN');await db.query('CREATE SCHEMA '+schema);await db.query('SET LOCAL search_path TO '+schema);
await db.query('CREATE TABLE "Booking" ("id" TEXT PRIMARY KEY,"pausedAt" TIMESTAMP,"resumedAt" TIMESTAMP,"isPaused" BOOLEAN,"endTime" TIMESTAMP)');await db.query('CREATE TABLE "BookingIntent" ("id" TEXT PRIMARY KEY)');
await db.query(`INSERT INTO "Booking" VALUES ('known','2026-10-01','2026-10-09',false,'2026-12-01'),('never',null,null,false,'2026-12-02')`);
await db.query(readFileSync(new URL('../prisma/migrations/202611030001_student_booking_history/migration.sql',import.meta.url),'utf8'));
assert.equal((await db.query('SELECT * FROM "BookingPauseEvent"')).rowCount,2);assert.equal((await db.query(`SELECT "endTime"::text AS "endTime" FROM "Booking" WHERE "id"='known'`)).rows[0].endTime.slice(0,10),'2026-12-01');assert.equal((await db.query(`SELECT * FROM "BookingPauseEvent" WHERE "bookingId"='never'`)).rowCount,0);
}finally{await db.query('ROLLBACK');await db.end();}
});
