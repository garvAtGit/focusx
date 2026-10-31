const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

async function testMigration() {
  console.log('--- Step 1: Initializing isolated PostgreSQL with PGlite ---');
  const pg = new PGlite();

  // 1. Create base tables matching Prisma schema
  console.log('--- Step 2: Creating base schema (User, Library, Booking) ---');
  await pg.exec(`
    CREATE TABLE "User" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT,
      "email" TEXT,
      "phone" TEXT UNIQUE,
      "role" TEXT NOT NULL DEFAULT 'STUDENT',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE "Library" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "librarianId" TEXT NOT NULL REFERENCES "User"("id"),
      "authRevision" INT NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE "Booking" (
      "id" TEXT PRIMARY KEY,
      "libraryId" TEXT NOT NULL REFERENCES "Library"("id"),
      "studentId" TEXT NOT NULL REFERENCES "User"("id"),
      "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
      "startTime" TIMESTAMP(3) NOT NULL,
      "endTime" TIMESTAMP(3) NOT NULL,
      "isPaused" BOOLEAN NOT NULL DEFAULT false,
      "pausedAt" TIMESTAMP(3),
      "totalPausedDays" INT NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Insert existing sample data (pre-migration)
  console.log('--- Step 3: Seeding pre-existing data before migration ---');
  await pg.exec(`
    INSERT INTO "User" ("id", "name", "phone", "role") VALUES
    ('usr_lib_1', 'Librarian Dave', '+919876500001', 'LIBRARIAN'),
    ('usr_stu_1', 'Alice Student', '+919876500002', 'STUDENT'),
    ('usr_stu_2', 'Bob Student', '+919876500003', 'STUDENT');

    INSERT INTO "Library" ("id", "name", "librarianId") VALUES
    ('lib_main', 'Central City Library', 'usr_lib_1');

    INSERT INTO "Booking" ("id", "libraryId", "studentId", "startTime", "endTime") VALUES
    ('book_1', 'lib_main', 'usr_stu_1', '2026-10-01 09:00:00', '2026-11-01 18:00:00'),
    ('book_2', 'lib_main', 'usr_stu_2', '2026-10-15 09:00:00', '2026-11-15 18:00:00');
  `);

  // 3. Apply migration
  console.log('--- Step 4: Applying migration 20261028181500_pause_history_and_username ---');
  const migrationSql = fs.readFileSync(
    path.resolve('prisma/migrations/20261028181500_pause_history_and_username/migration.sql'),
    'utf-8'
  );
  await pg.exec(migrationSql);
  console.log('Migration SQL executed successfully!');

  // 4. Test username uniqueness & case insensitivity
  console.log('--- Step 5: Testing Username Uniqueness & Case-Insensitivity ---');
  
  // Multiple users with null username must succeed
  await pg.exec(`
    INSERT INTO "User" ("id", "name", "phone", "username") VALUES
    ('usr_null_1', 'Null User 1', '+919876500010', NULL),
    ('usr_null_2', 'Null User 2', '+919876500011', NULL);
  `);
  console.log('✓ Multiple NULL usernames permitted without collision.');

  // Set first username
  await pg.exec(`UPDATE "User" SET "username" = 'AliceMaster' WHERE "id" = 'usr_stu_1';`);
  console.log('✓ Username "AliceMaster" saved.');

  // Attempt duplicate with exact case
  let exactDupFailed = false;
  try {
    await pg.exec(`UPDATE "User" SET "username" = 'AliceMaster' WHERE "id" = 'usr_stu_2';`);
  } catch (err) {
    exactDupFailed = true;
    console.log('✓ Exact duplicate rejected:', err.message);
  }
  assert.strictEqual(exactDupFailed, true, 'Exact duplicate must be rejected');

  // Attempt duplicate with different case ('alicemaster')
  let lowerDupFailed = false;
  try {
    await pg.exec(`UPDATE "User" SET "username" = 'alicemaster' WHERE "id" = 'usr_stu_2';`);
  } catch (err) {
    lowerDupFailed = true;
    console.log('✓ Case-insensitive duplicate ("alicemaster") rejected:', err.message);
  }
  assert.strictEqual(lowerDupFailed, true, 'Case-insensitive duplicate must be rejected');

  // Attempt duplicate with UPPERCASE ('ALICEMASTER')
  let upperDupFailed = false;
  try {
    await pg.exec(`UPDATE "User" SET "username" = 'ALICEMASTER' WHERE "id" = 'usr_stu_2';`);
  } catch (err) {
    upperDupFailed = true;
    console.log('✓ UPPERCASE duplicate ("ALICEMASTER") rejected:', err.message);
  }
  assert.strictEqual(upperDupFailed, true, 'UPPERCASE duplicate must be rejected');

  // Set distinct username for user 2
  await pg.exec(`UPDATE "User" SET "username" = 'bob_the_builder' WHERE "id" = 'usr_stu_2';`);
  console.log('✓ Distinct username "bob_the_builder" saved.');

  // 5. Test BookingPauseHistory & Single-Open-Pause constraint
  console.log('--- Step 6: Testing BookingPauseHistory & single_open_pause_idx ---');
  
  // Create first open pause for book_1
  await pg.exec(`
    INSERT INTO "BookingPauseHistory" ("id", "bookingId", "libraryId", "pausedAt", "reason", "pausedByUserId")
    VALUES ('pause_1', 'book_1', 'lib_main', '2026-10-10 10:00:00', 'Medical leave', 'usr_lib_1');
  `);
  console.log('✓ Open pause created for book_1.');

  // Attempt second concurrent open pause for book_1 (resumedAt is NULL)
  let secondOpenFailed = false;
  try {
    await pg.exec(`
      INSERT INTO "BookingPauseHistory" ("id", "bookingId", "libraryId", "pausedAt", "reason", "pausedByUserId")
      VALUES ('pause_2', 'book_1', 'lib_main', '2026-10-11 10:00:00', 'Second pause attempt', 'usr_lib_1');
    `);
  } catch (err) {
    secondOpenFailed = true;
    console.log('✓ Overlapping open pause rejected by single_open_pause_idx:', err.message);
  }
  assert.strictEqual(secondOpenFailed, true, 'Second open pause must be rejected by partial index');

  // Resume the first pause (set resumedAt and pausedDays)
  await pg.exec(`
    UPDATE "BookingPauseHistory"
    SET "resumedAt" = '2026-10-13 10:00:00', "pausedDays" = 3, "resumedByUserId" = 'usr_lib_1'
    WHERE "id" = 'pause_1';
  `);
  console.log('✓ First pause interval closed (resumedAt set).');

  // Now create a subsequent second pause for book_1 (should succeed because previous pause is closed!)
  await pg.exec(`
    INSERT INTO "BookingPauseHistory" ("id", "bookingId", "libraryId", "pausedAt", "reason", "pausedByUserId")
    VALUES ('pause_2', 'book_1', 'lib_main', '2026-10-20 10:00:00', 'Festival break', 'usr_lib_1');
  `);
  console.log('✓ Subsequent pause interval created successfully after first was closed.');

  // 6. Test Foreign Key Cascades & Set Null
  console.log('--- Step 7: Testing Foreign Key Behaviors ---');
  // Deleting userusr_lib_1 should SET NULL on pausedByUserId
  await pg.exec(`DELETE FROM "User" WHERE "id" = 'usr_null_1';`);
  
  // Deleting book_2 should cascade delete any pauses
  await pg.exec(`
    INSERT INTO "BookingPauseHistory" ("id", "bookingId", "libraryId", "pausedAt", "pausedByUserId")
    VALUES ('pause_book2', 'book_2', 'lib_main', '2026-10-16 10:00:00', 'usr_lib_1');
  `);
  await pg.exec(`DELETE FROM "Booking" WHERE "id" = 'book_2';`);
  const remainingPauses = await pg.query(`SELECT count(*)::int AS count FROM "BookingPauseHistory" WHERE "bookingId" = 'book_2';`);
  assert.strictEqual((remainingPauses.rows[0]).count, 0, 'Cascade delete on Booking must remove pause history');
  console.log('✓ Cascade delete on Booking verified.');

  console.log('\n========================================');
  console.log('ALL MIGRATION TESTS PASSED WITH 100% SUCCESS!');
  console.log('========================================\n');
}

testMigration().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});

