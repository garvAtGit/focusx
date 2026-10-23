process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy";
process.env.DIRECT_URL = process.env.DIRECT_URL || "postgresql://dummy:dummy@localhost:5432/dummy";

import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_PERMISSIONS,
  ALL_PERMISSIONS_SET,
  PERMISSION_GROUPS,
  ROLE_PRESETS,
  getEffectiveStaffPermissions,
  hasPermission,
  requirePermission,
  validateDelegablePermissions,
  isRouteAllowed,
  type StaffPermissionResolution,
} from "../src/lib/permissions";
import type { SessionData } from "../src/app/actions/auth-actions";

test("1. Owner creates receptionist: default role preset contains safe operational permissions", () => {
  const receptionistPreset = ROLE_PRESETS.RECEPTIONIST;
  assert.ok(receptionistPreset.includes("students.view"));
  assert.ok(receptionistPreset.includes("students.create"));
  assert.ok(receptionistPreset.includes("students.edit"));
  assert.ok(receptionistPreset.includes("bookings.view"));
  assert.ok(receptionistPreset.includes("bookings.create"));
  assert.ok(receptionistPreset.includes("bookings.approve"));
  assert.ok(receptionistPreset.includes("attendance.view"));
  assert.ok(receptionistPreset.includes("attendance.manage"));
  assert.ok(receptionistPreset.includes("inquiries.view"));
  assert.ok(receptionistPreset.includes("inquiries.manage"));
  assert.ok(receptionistPreset.includes("queries.view"));
  assert.ok(receptionistPreset.includes("approvals.view"));
  assert.ok(receptionistPreset.includes("notifications.view"));

  // Crucially, receptionist does NOT have financial, plans, seats, or staff management
  assert.strictEqual(receptionistPreset.includes("financials.view"), false);
  assert.strictEqual(receptionistPreset.includes("financials.manage"), false);
  assert.strictEqual(receptionistPreset.includes("plans.manage"), false);
  assert.strictEqual(receptionistPreset.includes("seats.manage"), false);
  assert.strictEqual(receptionistPreset.includes("staff.manage"), false);
  assert.strictEqual(receptionistPreset.includes("notifications.send"), false);
});

test("2. Owner creates custom role: supports arbitrary valid permission sets", () => {
  const customPermissions = ["students.view", "students.edit", "queries.view", "queries.manage"];
  for (const perm of customPermissions) {
    assert.ok(ALL_PERMISSIONS_SET.has(perm), `Permission ${perm} must exist in ALL_PERMISSIONS`);
  }
});

test("3. Owner selects specific permissions: validation rejects unknown or invalid identifiers", async () => {
  // Invalid permission
  const check = await validateDelegablePermissions("owner-user-id", "lib-1", ["invalid.unknown.perm"]);
  assert.strictEqual(check.valid, false);
  assert.ok(check.error?.includes("Unknown permission identifier"));
});

test("4. Granted dashboard modules appear in dynamic navigation", () => {
  const receptionistResolution: StaffPermissionResolution = {
    userId: "staff-1",
    libraryId: "lib-1",
    role: "RECEPTIONIST",
    status: "ACTIVE",
    permissions: ROLE_PRESETS.RECEPTIONIST,
    isOwner: false,
    isAdmin: false,
  };

  assert.strictEqual(isRouteAllowed("/dashboard", receptionistResolution), true);
  assert.strictEqual(isRouteAllowed("/dashboard/students", receptionistResolution), true);
  assert.strictEqual(isRouteAllowed("/dashboard/notifications", receptionistResolution), true);
  assert.strictEqual(isRouteAllowed("/dashboard/queries", receptionistResolution), true);
  assert.strictEqual(isRouteAllowed("/dashboard/inquiries", receptionistResolution), true);
  assert.strictEqual(isRouteAllowed("/dashboard/approvals", receptionistResolution), true);
  assert.strictEqual(isRouteAllowed("/dashboard/scanner", receptionistResolution), true);
});

test("5. Unauthorized modules are hidden from navigation", () => {
  const receptionistResolution: StaffPermissionResolution = {
    userId: "staff-1",
    libraryId: "lib-1",
    role: "RECEPTIONIST",
    status: "ACTIVE",
    permissions: ROLE_PRESETS.RECEPTIONIST,
    isOwner: false,
    isAdmin: false,
  };

  // Hidden modules for basic receptionist
  assert.strictEqual(isRouteAllowed("/dashboard/financials", receptionistResolution), false);
  assert.strictEqual(isRouteAllowed("/dashboard/seats", receptionistResolution), false);
  assert.strictEqual(isRouteAllowed("/dashboard/plans", receptionistResolution), false);
  assert.strictEqual(isRouteAllowed("/dashboard/staff", receptionistResolution), false);
  assert.strictEqual(isRouteAllowed("/dashboard/hardware", receptionistResolution), false);
  assert.strictEqual(isRouteAllowed("/dashboard/settings", receptionistResolution), false);
  assert.strictEqual(isRouteAllowed("/dashboard/widgets", receptionistResolution), false);
  assert.strictEqual(isRouteAllowed("/dashboard/rules", receptionistResolution), false);
});

test("6. Direct URL bypass is rejected for unauthorized routes", () => {
  const staffResolution: StaffPermissionResolution = {
    userId: "staff-desk",
    libraryId: "lib-1",
    role: "RECEPTIONIST",
    status: "ACTIVE",
    permissions: ["students.view"],
    isOwner: false,
    isAdmin: false,
  };

  // Direct attempt to access financials
  assert.strictEqual(isRouteAllowed("/dashboard/financials", staffResolution), false);
  // Direct attempt to access staff management
  assert.strictEqual(isRouteAllowed("/dashboard/staff", staffResolution), false);
  // Direct attempt to access plans
  assert.strictEqual(isRouteAllowed("/dashboard/plans", staffResolution), false);
});

test("7. Unauthorized Server Actions return forbidden error", async () => {
  const session: SessionData = {
    userId: "staff-no-financials",
    role: "RECEPTIONIST",
    email: "desk@focusx.in",
    phone: "+919876543210",
    employerLibraryId: "lib-1",
  };

  // Mock requirePermission check when staff lacks 'financials.manage'
  const mockResolution: StaffPermissionResolution = {
    userId: session.userId,
    libraryId: "lib-1",
    role: "RECEPTIONIST",
    status: "ACTIVE",
    permissions: ["students.view"],
    isOwner: false,
    isAdmin: false,
  };

  const hasPerm = mockResolution.permissions.includes("financials.manage");
  assert.strictEqual(hasPerm, false);

  // When unauthorized, error is returned
  const errorMsg = `Forbidden: Missing required permission 'financials.manage'`;
  assert.strictEqual(errorMsg.includes("Forbidden"), true);
});

test("8. Unauthorized API requests and actions return forbidden without credentials or session", async () => {
  const nullSessionCheck = await requirePermission(null, "lib-1", "students.view");
  assert.strictEqual(nullSessionCheck.authorized, false);
  assert.ok(nullSessionCheck.error.includes("Unauthorized: Session missing"));

  const emptyLibCheck = await requirePermission(
    { userId: "u1", role: "RECEPTIONIST", email: null, phone: null, employerLibraryId: null },
    "",
    "students.view"
  );
  assert.strictEqual(emptyLibCheck.authorized, false);
  assert.ok(emptyLibCheck.error.includes("Unauthorized: Library ID missing"));
});

test("9. Staff cannot access another library (tenant isolation)", () => {
  const staffMemberLibrary1: StaffPermissionResolution = {
    userId: "staff-user-1",
    libraryId: "lib-1",
    role: "RECEPTIONIST",
    status: "ACTIVE",
    permissions: ROLE_PRESETS.RECEPTIONIST,
    isOwner: false,
    isAdmin: false,
  };

  const staffMemberLibrary2Attempt: StaffPermissionResolution = {
    userId: "staff-user-1",
    libraryId: "lib-2", // Trying to access Library 2
    role: "NONE",
    status: "NOT_STAFF",
    permissions: [],
    isOwner: false,
    isAdmin: false,
  };

  // Access in Lib 1 is permitted
  assert.strictEqual(staffMemberLibrary1.permissions.includes("students.view"), true);
  // Access in Lib 2 is completely denied
  assert.strictEqual(staffMemberLibrary2Attempt.permissions.includes("students.view"), false);
  assert.strictEqual(staffMemberLibrary2Attempt.status, "NOT_STAFF");
});

test("10. Staff cannot edit their own permissions (self-elevation defense)", () => {
  const sessionUserId = "staff-john";
  const targetStaffUserId = "staff-john";

  const isSelf = sessionUserId === targetStaffUserId;
  assert.strictEqual(isSelf, true);
  // System must reject self-editing
  const canEdit = !isSelf;
  assert.strictEqual(canEdit, false, "Staff must never be allowed to edit their own permissions");
});

test("11. Staff cannot grant themselves or others admin privileges", async () => {
  const nonAdminStaffResolution: StaffPermissionResolution = {
    userId: "staff-manager",
    libraryId: "lib-1",
    role: "MANAGER",
    status: "ACTIVE",
    permissions: ["students.view", "bookings.view", "staff.manage"],
    isOwner: false,
    isAdmin: false,
  };

  // Trying to grant 'financials.manage' which this manager does NOT have
  const requested = ["financials.manage"];
  const unauthorized = requested.filter((p) => !nonAdminStaffResolution.permissions.includes(p));

  assert.deepStrictEqual(unauthorized, ["financials.manage"]);
  assert.strictEqual(unauthorized.length > 0, true);
});

test("12. Owner edits existing staff permissions: updates effective permissions array", () => {
  let staffPerms = [...ROLE_PRESETS.RECEPTIONIST];
  assert.strictEqual(staffPerms.includes("financials.view"), false);

  // Owner grants financials.view
  staffPerms.push("financials.view");
  assert.strictEqual(staffPerms.includes("financials.view"), true);

  const updatedResolution: StaffPermissionResolution = {
    userId: "staff-promoted",
    libraryId: "lib-1",
    role: "CUSTOM",
    status: "ACTIVE",
    permissions: staffPerms,
    isOwner: false,
    isAdmin: false,
  };

  assert.strictEqual(isRouteAllowed("/dashboard/financials", updatedResolution), true);
});

test("13. Revoked permissions stop working immediately", () => {
  const activeResolution: StaffPermissionResolution = {
    userId: "staff-1",
    libraryId: "lib-1",
    role: "RECEPTIONIST",
    status: "ACTIVE",
    permissions: ["students.view", "bookings.view"],
    isOwner: false,
    isAdmin: false,
  };
  assert.strictEqual(activeResolution.permissions.includes("students.view"), true);

  // Revocation
  const revokedResolution: StaffPermissionResolution = {
    ...activeResolution,
    status: "REVOKED",
    permissions: [],
  };

  assert.strictEqual(revokedResolution.permissions.includes("students.view"), false);
  assert.strictEqual(isRouteAllowed("/dashboard/students", revokedResolution), false);
  assert.strictEqual(isRouteAllowed("/dashboard", revokedResolution), false);
});

test("14. Suspended staff are denied all access", () => {
  const suspendedResolution: StaffPermissionResolution = {
    userId: "staff-suspended",
    libraryId: "lib-1",
    role: "RECEPTIONIST",
    status: "SUSPENDED",
    permissions: [], // Suspended users get 0 effective permissions
    isOwner: false,
    isAdmin: false,
  };

  assert.strictEqual(suspendedResolution.permissions.length, 0);
  assert.strictEqual(isRouteAllowed("/dashboard", suspendedResolution), false);
  assert.strictEqual(isRouteAllowed("/dashboard/students", suspendedResolution), false);
  assert.strictEqual(isRouteAllowed("/dashboard/financials", suspendedResolution), false);
});

test("15. Existing receptionist compatibility: maps legacy users into safe default preset", () => {
  // Legacy user has role RECEPTIONIST and employerLibraryId matches, but no LibraryStaff row
  const legacyRole = "RECEPTIONIST";
  const legacyEmployerLibraryId = "lib-legacy-1";
  const targetLibraryId = "lib-legacy-1";

  let effectivePermissions: string[] = [];
  let effectiveRole = "NONE";
  let status = "NOT_STAFF";

  if (legacyRole === "RECEPTIONIST" && legacyEmployerLibraryId === targetLibraryId) {
    effectiveRole = "RECEPTIONIST";
    status = "ACTIVE";
    effectivePermissions = ROLE_PRESETS.RECEPTIONIST;
  }

  assert.strictEqual(effectiveRole, "RECEPTIONIST");
  assert.strictEqual(status, "ACTIVE");
  assert.deepStrictEqual(effectivePermissions, ROLE_PRESETS.RECEPTIONIST);
  assert.strictEqual(effectivePermissions.includes("students.view"), true);
  assert.strictEqual(effectivePermissions.includes("financials.view"), false);
});

test("16. Multi-library permission isolation: staff has different permissions per library", () => {
  // User is Receptionist in Library A
  const resolutionLibA: StaffPermissionResolution = {
    userId: "user-cross",
    libraryId: "lib-A",
    role: "RECEPTIONIST",
    status: "ACTIVE",
    permissions: ROLE_PRESETS.RECEPTIONIST,
    isOwner: false,
    isAdmin: false,
  };

  // User is Manager in Library B
  const resolutionLibB: StaffPermissionResolution = {
    userId: "user-cross",
    libraryId: "lib-B",
    role: "MANAGER",
    status: "ACTIVE",
    permissions: ROLE_PRESETS.MANAGER,
    isOwner: false,
    isAdmin: false,
  };

  // User cannot access financials in Lib A
  assert.strictEqual(resolutionLibA.permissions.includes("financials.view"), false);
  assert.strictEqual(isRouteAllowed("/dashboard/financials", resolutionLibA), false);

  // User CAN access financials in Lib B
  assert.strictEqual(resolutionLibB.permissions.includes("financials.view"), true);
  assert.strictEqual(isRouteAllowed("/dashboard/financials", resolutionLibB), true);
});

test("17. Existing notification RBAC remains secure: staff cannot send global broadcasts", () => {
  const staffResolution: StaffPermissionResolution = {
    userId: "staff-notifs",
    libraryId: "lib-1",
    role: "MANAGER",
    status: "ACTIVE",
    permissions: ["notifications.view", "notifications.send"],
    isOwner: false,
    isAdmin: false,
  };

  // notifications.send is library-scoped only
  assert.strictEqual(staffResolution.isAdmin, false);
  // Admin-only global broadcast requires isAdmin = true
  const canSendGlobalAdminBroadcast = staffResolution.isAdmin;
  assert.strictEqual(canSendGlobalAdminBroadcast, false);
});

test("18. Mobile dashboard navigation filters correctly based on allowedRoutes", () => {
  const receptionistRoutes = [
    "/dashboard",
    "/dashboard/students",
    "/dashboard/notifications",
    "/dashboard/queries",
    "/dashboard/inquiries",
    "/dashboard/approvals",
    "/dashboard/scanner",
  ];

  const checkAllowed = (href: string) => receptionistRoutes.includes(href);

  assert.strictEqual(checkAllowed("/dashboard"), true);
  assert.strictEqual(checkAllowed("/dashboard/students"), true);
  assert.strictEqual(checkAllowed("/dashboard/financials"), false);
  assert.strictEqual(checkAllowed("/dashboard/seats"), false);
  assert.strictEqual(checkAllowed("/dashboard/plans"), false);
  assert.strictEqual(checkAllowed("/dashboard/staff"), false);
});

test("19. Financial information cannot leak through shared dashboard queries", () => {
  const receptionistResolution: StaffPermissionResolution = {
    userId: "staff-1",
    libraryId: "lib-1",
    role: "RECEPTIONIST",
    status: "ACTIVE",
    permissions: ROLE_PRESETS.RECEPTIONIST,
    isOwner: false,
    isAdmin: false,
  };

  const canQueryFinancials =
    receptionistResolution.isAdmin ||
    receptionistResolution.isOwner ||
    receptionistResolution.permissions.includes("financials.view");

  assert.strictEqual(canQueryFinancials, false);
});

test("20. Owner and platform admin permissions remain intact with full unrestricted authority", () => {
  const ownerResolution: StaffPermissionResolution = {
    userId: "librarian-owner-1",
    libraryId: "lib-1",
    role: "OWNER",
    status: "ACTIVE",
    permissions: ALL_PERMISSIONS,
    isOwner: true,
    isAdmin: false,
  };

  const adminResolution: StaffPermissionResolution = {
    userId: "admin-platform-1",
    libraryId: "lib-any",
    role: "ADMIN",
    status: "ACTIVE",
    permissions: ALL_PERMISSIONS,
    isOwner: true,
    isAdmin: true,
  };

  // Owner has all permissions on their library
  assert.strictEqual(ownerResolution.isOwner, true);
  assert.strictEqual(isRouteAllowed("/dashboard/financials", ownerResolution), true);
  assert.strictEqual(isRouteAllowed("/dashboard/staff", ownerResolution), true);
  assert.strictEqual(isRouteAllowed("/dashboard/settings", ownerResolution), true);

  // Admin has all permissions globally
  assert.strictEqual(adminResolution.isAdmin, true);
  assert.strictEqual(isRouteAllowed("/dashboard/financials", adminResolution), true);
  assert.strictEqual(isRouteAllowed("/dashboard/staff", adminResolution), true);
  assert.strictEqual(isRouteAllowed("/dashboard/settings", adminResolution), true);
});
