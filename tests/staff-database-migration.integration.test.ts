import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

test("PostgreSQL Migration & RBAC Database Integration Suite", async (t) => {
  const pg = new PGlite();

  await t.test("1. Setup prerequisite base schema (User & Library)", async () => {
    await pg.exec(`
      CREATE TABLE "User" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT,
        "phone" TEXT UNIQUE,
        "email" TEXT,
        "role" TEXT NOT NULL DEFAULT 'STUDENT',
        "employerLibraryId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "Library" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "librarianId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert library and owner
    await pg.exec(`
      INSERT INTO "User" ("id", "name", "phone", "role") VALUES
      ('owner_1', 'Library Owner', '+919999999999', 'LIBRARIAN'),
      ('owner_2', 'Second Owner', '+919999999998', 'LIBRARIAN'),
      ('legacy_recep_1', 'Legacy Receptionist', '+919888888888', 'RECEPTIONIST');

      INSERT INTO "Library" ("id", "name", "librarianId") VALUES
      ('lib_1', 'Main Downtown Library', 'owner_1'),
      ('lib_2', 'North Branch Library', 'owner_2');

      UPDATE "User" SET "employerLibraryId" = 'lib_1' WHERE "id" = 'legacy_recep_1';
    `);

    const userCount = await pg.query(`SELECT count(*)::int AS count FROM "User";`);
    assert.strictEqual((userCount.rows[0] as any).count, 3);
  });

  await t.test("2. Execute migration: 20261022160000_dynamic_staff_permissions", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "prisma/migrations/20261022160000_dynamic_staff_permissions/migration.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf-8");

    // Execute the actual migration SQL
    await pg.exec(sql);

    // Verify tables exist
    const tables = await pg.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('LibraryStaff', 'StaffAuditLog');
    `);
    const tableNames = tables.rows.map((r: any) => r.table_name);
    assert.ok(tableNames.includes("LibraryStaff"), "LibraryStaff table must exist");
    assert.ok(tableNames.includes("StaffAuditLog"), "StaffAuditLog table must exist");
  });

  await t.test("3. Verify legacy receptionist migration and automatic backfill", async () => {
    const staff = await pg.query(`
      SELECT * FROM "LibraryStaff" WHERE "userId" = 'legacy_recep_1';
    `);
    assert.strictEqual(staff.rows.length, 1, "Legacy receptionist must be backfilled");
    const record = staff.rows[0] as any;
    assert.strictEqual(record.libraryId, "lib_1");
    assert.strictEqual(record.role, "RECEPTIONIST");
    assert.strictEqual(record.status, "ACTIVE");
    assert.ok(Array.isArray(record.permissions), "Permissions must be an array");
    assert.ok(record.permissions.includes("students.view"));
    assert.ok(record.permissions.includes("bookings.view"));
    assert.ok(record.permissions.includes("attendance.manage"));
    assert.strictEqual(record.permissions.includes("financials.view"), false);
  });

  await t.test("4. Verify permission persistence for Custom staff", async () => {
    await pg.exec(`
      INSERT INTO "User" ("id", "name", "phone", "role") 
      VALUES ('custom_staff_1', 'Custom Staff Member', '+919777777777', 'RECEPTIONIST');

      INSERT INTO "LibraryStaff" ("id", "userId", "libraryId", "role", "customRoleName", "status", "permissions", "grantedById")
      VALUES ('ls_custom_1', 'custom_staff_1', 'lib_1', 'CUSTOM', 'Front Desk Lead', 'ACTIVE', 
              ARRAY['students.view', 'bookings.view', 'attendance.view'], 'owner_1');
    `);

    const res = await pg.query(`SELECT * FROM "LibraryStaff" WHERE "id" = 'ls_custom_1';`);
    const staff = res.rows[0] as any;
    assert.strictEqual(staff.role, "CUSTOM");
    assert.strictEqual(staff.customRoleName, "Front Desk Lead");
    assert.deepStrictEqual(staff.permissions, ['students.view', 'bookings.view', 'attendance.view']);

    // Update permissions
    await pg.query(`
      UPDATE "LibraryStaff" 
      SET "permissions" = ARRAY['students.view', 'bookings.view', 'attendance.view', 'inquiries.view']
      WHERE "id" = 'ls_custom_1';
    `);

    const updated = await pg.query(`SELECT "permissions" FROM "LibraryStaff" WHERE "id" = 'ls_custom_1';`);
    assert.strictEqual((updated.rows[0] as any).permissions.length, 4);
    assert.ok((updated.rows[0] as any).permissions.includes("inquiries.view"));
  });

  await t.test("5. Verify multi-library assignments and tenant isolation", async () => {
    // Same user custom_staff_1 assigned to lib_2 as MANAGER
    await pg.query(`
      INSERT INTO "LibraryStaff" ("id", "userId", "libraryId", "role", "status", "permissions", "grantedById")
      VALUES ('ls_custom_2', 'custom_staff_1', 'lib_2', 'MANAGER', 'ACTIVE', 
              ARRAY['students.view', 'students.create', 'bookings.view', 'bookings.create', 'attendance.manage'], 'owner_2');
    `);

    const lib1Staff = await pg.query(`SELECT * FROM "LibraryStaff" WHERE "userId" = 'custom_staff_1' AND "libraryId" = 'lib_1';`);
    const lib2Staff = await pg.query(`SELECT * FROM "LibraryStaff" WHERE "userId" = 'custom_staff_1' AND "libraryId" = 'lib_2';`);

    assert.strictEqual((lib1Staff.rows[0] as any).role, "CUSTOM");
    assert.strictEqual((lib2Staff.rows[0] as any).role, "MANAGER");

    // Unique constraint violation check: cannot assign same user to lib_1 twice
    await assert.rejects(
      async () => {
        await pg.query(`
          INSERT INTO "LibraryStaff" ("id", "userId", "libraryId", "role", "status", "permissions")
          VALUES ('ls_dup', 'custom_staff_1', 'lib_1', 'RECEPTIONIST', 'ACTIVE', ARRAY['students.view']);
        `);
      },
      /unique|duplicate/i,
      "Duplicate user-library assignment must be rejected by unique constraint"
    );
  });

  await t.test("6. Verify staff audit logging", async () => {
    await pg.query(`
      INSERT INTO "StaffAuditLog" (
        "id", "libraryStaffId", "actorId", "action", 
        "previousRole", "newRole", "previousStatus", "newStatus", 
        "previousPerms", "newPerms", "reason"
      ) VALUES (
        'audit_1', 'ls_custom_1', 'owner_1', 'PERMISSIONS_UPDATE',
        'CUSTOM', 'CUSTOM', 'ACTIVE', 'ACTIVE',
        ARRAY['students.view', 'bookings.view', 'attendance.view'],
        ARRAY['students.view', 'bookings.view', 'attendance.view', 'inquiries.view'],
        'Promoted to handle inquiry inquiries'
      );
    `);

    const audit = await pg.query(`SELECT * FROM "StaffAuditLog" WHERE "libraryStaffId" = 'ls_custom_1';`);
    assert.strictEqual(audit.rows.length, 1);
    assert.strictEqual((audit.rows[0] as any).action, "PERMISSIONS_UPDATE");
    assert.strictEqual((audit.rows[0] as any).reason, "Promoted to handle inquiry inquiries");
  });

  await t.test("7. Verify staff suspension and revocation preserves other libraries", async () => {
    // Suspend in lib_1
    await pg.query(`
      UPDATE "LibraryStaff" SET "status" = 'SUSPENDED' WHERE "id" = 'ls_custom_1';
    `);

    const check1 = await pg.query(`SELECT "status" FROM "LibraryStaff" WHERE "id" = 'ls_custom_1';`);
    const check2 = await pg.query(`SELECT "status" FROM "LibraryStaff" WHERE "id" = 'ls_custom_2';`);

    assert.strictEqual((check1.rows[0] as any).status, "SUSPENDED");
    assert.strictEqual((check2.rows[0] as any).status, "ACTIVE", "Suspension in lib_1 must NOT affect lib_2 membership");

    // Revoke in lib_1
    await pg.query(`
      UPDATE "LibraryStaff" SET "status" = 'REVOKED' WHERE "id" = 'ls_custom_1';
    `);
    const checkRevoked = await pg.query(`SELECT "status" FROM "LibraryStaff" WHERE "id" = 'ls_custom_1';`);
    assert.strictEqual((checkRevoked.rows[0] as any).status, "REVOKED");
    const checkStillActive = await pg.query(`SELECT "status" FROM "LibraryStaff" WHERE "id" = 'ls_custom_2';`);
    assert.strictEqual((checkStillActive.rows[0] as any).status, "ACTIVE");
  });

  await t.test("8. Verify migration idempotency (safe second run without error)", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "prisma/migrations/20261022160000_dynamic_staff_permissions/migration.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf-8");

    // Re-run migration SQL to ensure it is 100% idempotent on live environments
    await pg.exec(sql);

    // Verify existing staff records were not duplicated or wiped
    const count = await pg.query(`SELECT count(*)::int AS count FROM "LibraryStaff";`);
    assert.strictEqual((count.rows[0] as any).count, 3, "Idempotent re-run must not duplicate records");
  });
});
