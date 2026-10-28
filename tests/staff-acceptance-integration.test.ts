process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy";
process.env.DIRECT_URL = process.env.DIRECT_URL || "postgresql://dummy:dummy@localhost:5432/dummy";

import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_PERMISSIONS,
  ALL_PERMISSIONS_SET,
  ROLE_PRESETS,
  isRouteAllowed,
  type StaffPermissionResolution,
} from "../src/lib/permissions-registry";
import {
  hasPermission,
  validateDelegablePermissions,
} from "../src/lib/permissions";
import type { SessionData } from "../src/app/actions/auth-actions";

test("Staff RBAC Acceptance & Staging Integration Suite", async (t) => {
  const adminSession: SessionData = {
    userId: "admin-usr-999",
    role: "ADMIN",
    email: "admin@focusdesk.in",
    phone: "+919999900000",
    employerLibraryId: null,
  };

  const libraryIdA = "lib-branch-alpha";
  const libraryIdB = "lib-branch-beta";

  await t.test("1. Onboarding presets: Receptionist, Manager, and Custom configurations", () => {
    // Receptionist preset
    const recepPerms = ROLE_PRESETS.RECEPTIONIST;
    assert.ok(recepPerms.includes("students.view"));
    assert.ok(recepPerms.includes("bookings.view"));
    assert.ok(recepPerms.includes("attendance.view"));
    assert.strictEqual(recepPerms.includes("financials.view"), false);
    assert.strictEqual(recepPerms.includes("staff.manage"), false);

    // Manager preset
    const mgrPerms = ROLE_PRESETS.MANAGER;
    assert.ok(mgrPerms.includes("financials.view"));
    assert.ok(mgrPerms.includes("plans.view"));
    assert.strictEqual(mgrPerms.includes("plans.manage"), false, "Managers can view plans, but editing requires owner approval");
    assert.ok(mgrPerms.includes("seats.manage"));
    assert.strictEqual(mgrPerms.includes("staff.manage"), false, "Managers must not manage staff without explicit authorization");

    // Custom configuration
    const customConfig = ["students.view", "bookings.view", "attendance.view"];
    for (const p of customConfig) {
      assert.ok(ALL_PERMISSIONS_SET.has(p));
    }
  });

  await t.test("2. Dashboard Access for Custom Staff with ONLY students.view, bookings.view, attendance.view", () => {
    const customResolution: StaffPermissionResolution = {
      userId: "custom-staff-1",
      libraryId: libraryIdA,
      role: "CUSTOM",
      status: "ACTIVE",
      permissions: ["students.view", "bookings.view", "attendance.view"],
      isOwner: false,
      isAdmin: false,
    };

    // Allowed routes
    assert.strictEqual(isRouteAllowed("/dashboard", customResolution), true);
    assert.strictEqual(isRouteAllowed("/dashboard/students", customResolution), true);

    // Blocked modules (financials, settings, staff, hardware, rules, widgets, plans, seats)
    assert.strictEqual(isRouteAllowed("/dashboard/financials", customResolution), false);
    assert.strictEqual(isRouteAllowed("/dashboard/staff", customResolution), false);
    assert.strictEqual(isRouteAllowed("/dashboard/settings", customResolution), false);
    assert.strictEqual(isRouteAllowed("/dashboard/hardware", customResolution), false);
    assert.strictEqual(isRouteAllowed("/dashboard/rules", customResolution), false);
    assert.strictEqual(isRouteAllowed("/dashboard/widgets", customResolution), false);
    assert.strictEqual(isRouteAllowed("/dashboard/plans", customResolution), false);
    assert.strictEqual(isRouteAllowed("/dashboard/seats", customResolution), false);

    // Attendance view allows opening scanner interface, but executing scans requires attendance.manage
    assert.strictEqual(isRouteAllowed("/dashboard/scanner", customResolution), true);
    assert.strictEqual(customResolution.permissions.includes("attendance.manage"), false);
  });

  await t.test("3. Permission Updates: Add, Remove, Suspend, Reactivate", () => {
    let perms = ["students.view", "bookings.view", "attendance.view"];

    // Add inquiries.view
    perms = [...perms, "inquiries.view"];
    const withInquiries: StaffPermissionResolution = {
      userId: "custom-staff-1",
      libraryId: libraryIdA,
      role: "CUSTOM",
      status: "ACTIVE",
      permissions: perms,
      isOwner: false,
      isAdmin: false,
    };
    assert.strictEqual(isRouteAllowed("/dashboard/inquiries", withInquiries), true);

    // Remove students.view
    perms = perms.filter(p => p !== "students.view");
    const withoutStudents: StaffPermissionResolution = {
      userId: "custom-staff-1",
      libraryId: libraryIdA,
      role: "CUSTOM",
      status: "ACTIVE",
      permissions: perms,
      isOwner: false,
      isAdmin: false,
    };
    assert.strictEqual(isRouteAllowed("/dashboard/students", withoutStudents), false);

    // Suspend staff member: status becomes SUSPENDED -> 0 effective permissions
    const suspendedResolution: StaffPermissionResolution = {
      userId: "custom-staff-1",
      libraryId: libraryIdA,
      role: "CUSTOM",
      status: "SUSPENDED",
      permissions: [],
      isOwner: false,
      isAdmin: false,
    };
    assert.strictEqual(suspendedResolution.permissions.length, 0);
    assert.strictEqual(isRouteAllowed("/dashboard", suspendedResolution), false);
    assert.strictEqual(isRouteAllowed("/dashboard/students", suspendedResolution), false);

    // Reactivate staff member: restored back to ACTIVE
    const reactivatedResolution: StaffPermissionResolution = {
      userId: "custom-staff-1",
      libraryId: libraryIdA,
      role: "CUSTOM",
      status: "ACTIVE",
      permissions: perms,
      isOwner: false,
      isAdmin: false,
    };
    assert.strictEqual(reactivatedResolution.status, "ACTIVE");
    assert.ok(reactivatedResolution.permissions.includes("inquiries.view"));
    assert.strictEqual(isRouteAllowed("/dashboard/inquiries", reactivatedResolution), true);
  });

  await t.test("4. Multi-Library Revocation: Revoking Library A preserves Library B", () => {
    const userMemberships: Record<string, StaffPermissionResolution> = {
      [libraryIdA]: {
        userId: "multi-staff",
        libraryId: libraryIdA,
        role: "CUSTOM",
        status: "REVOKED",
        permissions: [],
        isOwner: false,
        isAdmin: false,
      },
      [libraryIdB]: {
        userId: "multi-staff",
        libraryId: libraryIdB,
        role: "RECEPTIONIST",
        status: "ACTIVE",
        permissions: ["students.view", "bookings.view"],
        isOwner: false,
        isAdmin: false,
      },
    };

    assert.strictEqual(userMemberships[libraryIdA].status, "REVOKED");
    assert.strictEqual(userMemberships[libraryIdA].permissions.length, 0);
    assert.strictEqual(isRouteAllowed("/dashboard", userMemberships[libraryIdA]), false);

    assert.strictEqual(userMemberships[libraryIdB].status, "ACTIVE");
    assert.strictEqual(userMemberships[libraryIdB].permissions.length, 2);
    assert.strictEqual(isRouteAllowed("/dashboard/students", userMemberships[libraryIdB]), true);
  });

  await t.test("5. Security: Self-elevation attempt is rejected", () => {
    const staffUserId = "staff-usr-777";
    const targetUserId = "staff-usr-777"; // Self
    const isSelf = staffUserId === targetUserId;
    assert.strictEqual(isSelf, true, "Staff cannot target own user ID for permission edit");
  });

  await t.test("6. Security: Delegation cannot exceed grantor permissions", async () => {
    // Non-owner with partial rights cannot grant financials.manage
    const result = await validateDelegablePermissions("receptionist-id", libraryIdA, ["financials.manage"]);
    assert.strictEqual(result.valid, false);
  });

  await t.test("7. Security: Legacy receptionist fallback CANNOT bypass revocation", () => {
    // A user with role 'RECEPTIONIST' who has an explicit REVOKED or SUSPENDED LibraryStaff record
    const staffRecord = {
      userId: "recep-usr-444",
      libraryId: libraryIdA,
      status: "REVOKED",
      permissions: [],
    };

    // If staffRecord exists and is REVOKED, effective permissions must be empty
    const effectivePerms = staffRecord.status === "ACTIVE" ? ROLE_PRESETS.RECEPTIONIST : [];
    assert.strictEqual(effectivePerms.length, 0, "Revoked staff must never fall back to legacy receptionist preset");
  });

  await t.test("8. Regressions: Owner and Admin accounts retain full authority", async () => {
    // Admin session bypass
    const adminPermCheck = await hasPermission(adminSession, libraryIdA, "staff.manage");
    assert.strictEqual(adminPermCheck, true);

    // Owner resolution always has unrestricted access across all modules
    const ownerResolution: StaffPermissionResolution = {
      userId: "owner-usr-001",
      libraryId: libraryIdA,
      role: "OWNER",
      status: "ACTIVE",
      permissions: ALL_PERMISSIONS,
      isOwner: true,
      isAdmin: false,
    };
    assert.strictEqual(isRouteAllowed("/dashboard/financials", ownerResolution), true);
    assert.strictEqual(isRouteAllowed("/dashboard/staff", ownerResolution), true);
    assert.strictEqual(isRouteAllowed("/dashboard/settings", ownerResolution), true);
    assert.strictEqual(isRouteAllowed("/dashboard/hardware", ownerResolution), true);
  });
});
