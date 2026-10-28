import { getSession } from "@/app/actions/auth-actions";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { UserPlus, Shield } from "lucide-react";
import { StaffForm } from "./StaffForm";
import { StaffManagementList, type StaffItem } from "./StaffManagementList";
import { getActiveLibrary } from "@/lib/dashboard-utils";
import { hasPermission, ROLE_PRESETS } from "@/lib/permissions";

export default async function StaffPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const library = await getActiveLibrary(session);
  if (!library) redirect("/onboarding");

  // Granular Permission Guard: staff.view
  const canViewStaff = await hasPermission(session, library.id, 'staff.view');
  if (!canViewStaff) {
    redirect("/dashboard");
  }

  // Capability check: staff.manage
  const canManageStaff = await hasPermission(session, library.id, 'staff.manage');

  // Fetch all active LibraryStaff memberships for this library
  const staffMemberships = await prisma.libraryStaff.findMany({
    where: {
      libraryId: library.id,
      status: { not: 'REVOKED' },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          phone: true,
          role: true,
        },
      },
      library: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Fetch legacy receptionists who do not have a LibraryStaff row yet
  const legacyReceptionists = await prisma.user.findMany({
    where: {
      employerLibraryId: library.id,
      role: 'RECEPTIONIST',
      staffMemberships: {
        none: { libraryId: library.id },
      },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Map to unified StaffItem format
  const mappedStaff: StaffItem[] = [
    ...staffMemberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      phone: m.user.phone,
      role: m.role,
      customRoleName: m.customRoleName,
      status: m.status,
      permissions: m.permissions,
      updatedAt: m.updatedAt.toISOString(),
      libraryName: m.library.name,
      isLegacy: false,
    })),
    ...legacyReceptionists.map((u) => ({
      id: `legacy_${u.id}`,
      userId: u.id,
      name: u.name,
      phone: u.phone,
      role: "RECEPTIONIST" as const,
      customRoleName: null,
      status: "ACTIVE" as const,
      permissions: ROLE_PRESETS.RECEPTIONIST,
      updatedAt: u.updatedAt.toISOString(),
      libraryName: library.name,
      isLegacy: true,
    })),
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-heading font-black text-foreground tracking-tight">Staff & Roles</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Configure role templates and granular permissions for staff members at <strong className="text-foreground">{library.name}</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Add Staff Form */}
        <div className="lg:col-span-5 bg-card p-6 rounded-3xl border border-border shadow-xs h-fit">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-primary/10 text-primary rounded-2xl">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-heading text-foreground">Add Staff Member</h2>
              <p className="text-xs text-muted-foreground">Authorize a new receptionist or manager</p>
            </div>
          </div>

          {canManageStaff ? (
            <StaffForm libraryName={library.name} />
          ) : (
            <div className="p-6 border border-dashed rounded-2xl bg-muted/20 text-center text-xs text-muted-foreground">
              You have view-only access to staff members. Managing staff requires the <code className="font-mono text-primary">staff.manage</code> permission.
            </div>
          )}
        </div>

        {/* Right Column: Active Staff Roster */}
        <div className="lg:col-span-7 bg-card p-6 rounded-3xl border border-border shadow-xs flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-muted text-foreground rounded-2xl">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold font-heading text-foreground">Active Staff Roster</h2>
                <p className="text-xs text-muted-foreground">
                  {mappedStaff.length} staff member{mappedStaff.length === 1 ? "" : "s"} authorized
                </p>
              </div>
            </div>
          </div>

          <StaffManagementList
            staffList={mappedStaff}
            canManage={canManageStaff}
            currentUserId={session.userId}
            libraryId={library.id}
          />
        </div>
      </div>
    </div>
  );
}
