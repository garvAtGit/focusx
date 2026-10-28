export type PermissionOperation =
  | 'VIEW'
  | 'CREATE'
  | 'EDIT'
  | 'DELETE'
  | 'MANAGE'
  | 'APPROVE'
  | 'EXPORT'
  | 'EXECUTE';

export interface PermissionDefinition {
  id: string;
  module: string;
  operation: PermissionOperation;
  label: string;
  description: string;
  prerequisites?: string[];
}

export interface PermissionGroup {
  key: string;
  label: string;
  description: string;
  permissions: PermissionDefinition[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: 'students',
    label: 'Students & Members',
    description: 'Manage registered student directory and student profile records',
    permissions: [
      {
        id: 'students.view',
        module: 'students',
        operation: 'VIEW',
        label: 'View Students',
        description: 'View student list, details, contact info and KYC statuses',
      },
      {
        id: 'students.create',
        module: 'students',
        operation: 'CREATE',
        label: 'Add Students',
        description: 'Create and onboard new student profiles',
        prerequisites: ['students.view'],
      },
      {
        id: 'students.edit',
        module: 'students',
        operation: 'EDIT',
        label: 'Edit Students',
        description: 'Update student profiles, IDs, notes, and CRM records',
        prerequisites: ['students.view'],
      },
      {
        id: 'students.delete',
        module: 'students',
        operation: 'DELETE',
        label: 'Delete Students',
        description: 'Remove or archive student profiles',
        prerequisites: ['students.view'],
      },
      {
        id: 'students.export',
        module: 'students',
        operation: 'EXPORT',
        label: 'Export Students',
        description: 'Download student directory reports and CSV exports',
        prerequisites: ['students.view'],
      },
    ],
  },
  {
    key: 'bookings',
    label: 'Bookings & Seats',
    description: 'Manage seat bookings, renewals, and slot allocations',
    permissions: [
      {
        id: 'bookings.view',
        module: 'bookings',
        operation: 'VIEW',
        label: 'View Bookings',
        description: 'View active, pending and past seat bookings and occupancy',
      },
      {
        id: 'bookings.create',
        module: 'bookings',
        operation: 'CREATE',
        label: 'Create Bookings',
        description: 'Create offline, manual and reception seat bookings',
        prerequisites: ['bookings.view'],
      },
      {
        id: 'bookings.edit',
        module: 'bookings',
        operation: 'EDIT',
        label: 'Modify Bookings',
        description: 'Reschedule bookings, change dates, and shift seats',
        prerequisites: ['bookings.view'],
      },
      {
        id: 'bookings.cancel',
        module: 'bookings',
        operation: 'DELETE',
        label: 'Cancel Bookings',
        description: 'Revoke or cancel active bookings with optional refund',
        prerequisites: ['bookings.view'],
      },
      {
        id: 'bookings.approve',
        module: 'bookings',
        operation: 'APPROVE',
        label: 'Approve Payments',
        description: 'Confirm cash and offline reception payments for bookings',
        prerequisites: ['bookings.view'],
      },
    ],
  },
  {
    key: 'attendance',
    label: 'Attendance & Scanners',
    description: 'Track student check-ins, check-outs, and scanner logs',
    permissions: [
      {
        id: 'attendance.view',
        module: 'attendance',
        operation: 'VIEW',
        label: 'View Attendance',
        description: 'View live occupancy, check-in history, and student entries',
      },
      {
        id: 'attendance.manage',
        module: 'attendance',
        operation: 'MANAGE',
        label: 'Manage Attendance',
        description: 'Operate web scanner, trigger manual check-in/out, and sync RFID',
        prerequisites: ['attendance.view'],
      },
    ],
  },
  {
    key: 'approvals',
    label: 'Approvals & Verification',
    description: 'Review student KYC documents and manual payment verifications',
    permissions: [
      {
        id: 'approvals.view',
        module: 'approvals',
        operation: 'VIEW',
        label: 'View Approvals',
        description: 'View pending Aadhaar KYC and payment approval requests',
      },
      {
        id: 'approvals.manage',
        module: 'approvals',
        operation: 'APPROVE',
        label: 'Approve / Reject Requests',
        description: 'Approve or reject pending KYC documents and payments',
        prerequisites: ['approvals.view'],
      },
    ],
  },
  {
    key: 'financials',
    label: 'Financials & Expenses',
    description: 'Track library income, expenses, and financial health',
    permissions: [
      {
        id: 'financials.view',
        module: 'financials',
        operation: 'VIEW',
        label: 'View Financials',
        description: 'View revenue totals, expense breakdown, and financial charts',
      },
      {
        id: 'financials.manage',
        module: 'financials',
        operation: 'MANAGE',
        label: 'Manage Expenses',
        description: 'Log new operating expenses and delete expense entries',
        prerequisites: ['financials.view'],
      },
      {
        id: 'financials.export',
        module: 'financials',
        operation: 'EXPORT',
        label: 'Export Financial Reports',
        description: 'Download P&L and expense spreadsheets',
        prerequisites: ['financials.view'],
      },
    ],
  },
  {
    key: 'seats',
    label: 'Seat Layout & Lockers',
    description: 'Configure library floor plans, seats, and standalone lockers',
    permissions: [
      {
        id: 'seats.view',
        module: 'seats',
        operation: 'VIEW',
        label: 'View Seat Map',
        description: 'View interactive seat map and locker availability',
      },
      {
        id: 'seats.manage',
        module: 'seats',
        operation: 'MANAGE',
        label: 'Manage Layout',
        description: 'Add seats, update layout, set seat pricing, and configure lockers',
        prerequisites: ['seats.view'],
      },
    ],
  },
  {
    key: 'plans',
    label: 'Membership Plans',
    description: 'Manage pricing tiers, fixed plans, and flexible packages',
    permissions: [
      {
        id: 'plans.view',
        module: 'plans',
        operation: 'VIEW',
        label: 'View Plans',
        description: 'View active and archived membership plans',
      },
      {
        id: 'plans.manage',
        module: 'plans',
        operation: 'MANAGE',
        label: 'Manage Plans',
        description: 'Create, update, toggle or delete library plans',
        prerequisites: ['plans.view'],
      },
    ],
  },
  {
    key: 'inquiries',
    label: 'Inquiries & CRM Leads',
    description: 'Track prospective student inquiries and walk-in leads',
    permissions: [
      {
        id: 'inquiries.view',
        module: 'inquiries',
        operation: 'VIEW',
        label: 'View Inquiries',
        description: 'View list of prospective student leads and status',
      },
      {
        id: 'inquiries.manage',
        module: 'inquiries',
        operation: 'MANAGE',
        label: 'Manage Inquiries',
        description: 'Add follow-up notes, change inquiry status, and convert leads',
        prerequisites: ['inquiries.view'],
      },
    ],
  },
  {
    key: 'queries',
    label: 'Queries & Complaints',
    description: 'Student feedback, complaint tickets, and resolution notes',
    permissions: [
      {
        id: 'queries.view',
        module: 'queries',
        operation: 'VIEW',
        label: 'View Queries',
        description: 'Read student feedback, complaints and rating reviews',
      },
      {
        id: 'queries.manage',
        module: 'queries',
        operation: 'MANAGE',
        label: 'Resolve Queries',
        description: 'Update resolution status and respond to student complaints',
        prerequisites: ['queries.view'],
      },
    ],
  },
  {
    key: 'notifications',
    label: 'Notifications & Broadcasts',
    description: 'Send broadcasts and view notification history',
    permissions: [
      {
        id: 'notifications.view',
        module: 'notifications',
        operation: 'VIEW',
        label: 'View Notifications',
        description: 'View notification log and sent broadcast history',
      },
      {
        id: 'notifications.send',
        module: 'notifications',
        operation: 'EXECUTE',
        label: 'Send Broadcasts',
        description: 'Send notifications to students of this library (library-scoped)',
        prerequisites: ['notifications.view'],
      },
    ],
  },
  {
    key: 'hardware',
    label: 'Hardware & Access Control',
    description: 'Configure relay doors, BLE scanners, and smart locks',
    permissions: [
      {
        id: 'hardware.view',
        module: 'hardware',
        operation: 'VIEW',
        label: 'View Hardware',
        description: 'View connected relay controllers and reader devices',
      },
      {
        id: 'hardware.manage',
        module: 'hardware',
        operation: 'MANAGE',
        label: 'Manage Hardware',
        description: 'Claim hardware, configure relays, and trigger emergency unlock',
        prerequisites: ['hardware.view'],
      },
    ],
  },
  {
    key: 'rules',
    label: 'Automation Rules',
    description: 'Configure automated overstay alerts, reminder rules, and triggers',
    permissions: [
      {
        id: 'rules.view',
        module: 'rules',
        operation: 'VIEW',
        label: 'View Automation Rules',
        description: 'View active library automation rules and execution logs',
      },
      {
        id: 'rules.manage',
        module: 'rules',
        operation: 'MANAGE',
        label: 'Manage Automation Rules',
        description: 'Create, update, or toggle automated rules',
        prerequisites: ['rules.view'],
      },
    ],
  },
  {
    key: 'staff',
    label: 'Staff Management',
    description: 'Manage staff accounts, roles, and granular permissions',
    permissions: [
      {
        id: 'staff.view',
        module: 'staff',
        operation: 'VIEW',
        label: 'View Staff',
        description: 'View active staff list, role assignments, and audit history',
      },
      {
        id: 'staff.manage',
        module: 'staff',
        operation: 'MANAGE',
        label: 'Manage Staff & Roles',
        description: 'Invite staff, edit permissions, suspend, or revoke access',
        prerequisites: ['staff.view'],
      },
    ],
  },
  {
    key: 'settings',
    label: 'Library Settings',
    description: 'Manage library profile, operating hours, and configurations',
    permissions: [
      {
        id: 'settings.view',
        module: 'settings',
        operation: 'VIEW',
        label: 'View Settings',
        description: 'View library details, timings, and configuration',
      },
      {
        id: 'settings.manage',
        module: 'settings',
        operation: 'MANAGE',
        label: 'Edit Settings',
        description: 'Update library name, photos, opening hours, and policies',
        prerequisites: ['settings.view'],
      },
    ],
  },
  {
    key: 'widgets',
    label: 'Public Widgets',
    description: 'Configure embeddable website widgets and public links',
    permissions: [
      {
        id: 'widgets.view',
        module: 'widgets',
        operation: 'VIEW',
        label: 'View Widgets',
        description: 'View embed widget previews and integration snippets',
      },
      {
        id: 'widgets.manage',
        module: 'widgets',
        operation: 'MANAGE',
        label: 'Configure Widgets',
        description: 'Generate and customize embed codes for external sites',
        prerequisites: ['widgets.view'],
      },
    ],
  },
];

export const ALL_PERMISSIONS: string[] = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.id)
);

export const ALL_PERMISSIONS_SET = new Set(ALL_PERMISSIONS);

export const ROLE_PRESETS: Record<'RECEPTIONIST' | 'MANAGER' | 'CUSTOM', string[]> = {
  RECEPTIONIST: [
    'students.view',
    'students.create',
    'students.edit',
    'bookings.view',
    'bookings.create',
    'bookings.approve',
    'attendance.view',
    'attendance.manage',
    'inquiries.view',
    'inquiries.manage',
    'queries.view',
    'approvals.view',
    'notifications.view',
  ],
  MANAGER: [
    'students.view',
    'students.create',
    'students.edit',
    'students.delete',
    'students.export',
    'bookings.view',
    'bookings.create',
    'bookings.edit',
    'bookings.cancel',
    'bookings.approve',
    'attendance.view',
    'attendance.manage',
    'approvals.view',
    'approvals.manage',
    'financials.view',
    'financials.manage',
    'seats.view',
    'seats.manage',
    'plans.view',
    'inquiries.view',
    'inquiries.manage',
    'queries.view',
    'queries.manage',
    'notifications.view',
    'notifications.send',
    'hardware.view',
    'hardware.manage',
    'staff.view',
  ],
  CUSTOM: [],
};

export type StaffPermissionResolution = {
  userId: string;
  libraryId: string;
  role: 'ADMIN' | 'OWNER' | 'MANAGER' | 'RECEPTIONIST' | 'CUSTOM' | 'NONE';
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REVOKED' | 'NOT_STAFF';
  permissions: string[];
  isOwner: boolean;
  isAdmin: boolean;
};

/**
 * Map dashboard navigation items to their required permission identifiers.
 */
export const DASHBOARD_NAV_PERMISSIONS: Record<string, string> = {
  '/dashboard/students': 'students.view',
  '/dashboard/notifications': 'notifications.view',
  '/dashboard/queries': 'queries.view',
  '/dashboard/inquiries': 'inquiries.view',
  '/dashboard/approvals': 'approvals.view',
  '/dashboard/scanner': 'attendance.view',
  '/dashboard/financials': 'financials.view',
  '/dashboard/seats': 'seats.view',
  '/dashboard/plans': 'plans.view',
  '/dashboard/hardware': 'hardware.view',
  '/dashboard/rules': 'rules.view',
  '/dashboard/staff': 'staff.view',
  '/dashboard/widgets': 'widgets.view',
  '/dashboard/settings': 'settings.view',
};

/**
 * Determine if a specific route href is allowed given effective permissions.
 */
export function isRouteAllowed(
  href: string,
  resolution: StaffPermissionResolution
): boolean {
  if (resolution.isAdmin || resolution.isOwner) return true;
  if (resolution.status !== 'ACTIVE') return false;

  // Overview /dashboard is accessible if staff has at least 1 active permission
  if (href === '/dashboard') {
    return resolution.permissions.length > 0;
  }

  const requiredPerm = DASHBOARD_NAV_PERMISSIONS[href];
  if (!requiredPerm) return true; // Unmapped paths default to allowed for active staff

  return resolution.permissions.includes(requiredPerm);
}
