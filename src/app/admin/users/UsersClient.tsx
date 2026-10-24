'use client';

import { useState, useTransition } from 'react';
import {
  Users,
  Search,
  ShieldCheck,
  Building,
  GraduationCap,
  KeyRound,
  CheckCircle2,
  XCircle,
  CreditCard,
  Flame,
  Radio,
  Edit2,
  Loader2,
  X,
  Phone,
  Mail,
} from 'lucide-react';
import { updateUserRole } from '@/app/actions/admin-actions';
import type { Role } from '@prisma/client';
import toast from 'react-hot-toast';

interface UserRecord {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: Role;
  uniqueId: string | null;
  rfidTag: string | null;
  walletBalance: number;
  currentStreak: number;
  digilockerVerified: boolean;
  createdAt: Date;
  _count: {
    bookings: number;
    checkins: number;
  };
}

export function UsersClient({
  initialUsers,
  currentAdminId,
}: {
  initialUsers: UserRecord[];
  currentAdminId: string;
}) {
  const [users, setUsers] = useState<UserRecord[]>(initialUsers);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | Role>('ALL');
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredUsers = users.filter((u) => {
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

    const query = search.toLowerCase().trim();
    const matchesSearch =
      !query ||
      u.name.toLowerCase().includes(query) ||
      (u.phone && u.phone.includes(query)) ||
      (u.email && u.email.toLowerCase().includes(query)) ||
      (u.uniqueId && u.uniqueId.toLowerCase().includes(query)) ||
      (u.rfidTag && u.rfidTag.toLowerCase().includes(query));

    return matchesRole && matchesSearch;
  });

  const handleRoleChange = (userId: string, newRole: Role) => {
    startTransition(async () => {
      try {
        await updateUserRole(userId, newRole);
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
        if (selectedUser && selectedUser.id === userId) {
          setSelectedUser({ ...selectedUser, role: newRole });
        }
        toast.success(`User role updated to ${newRole}`);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to update role');
      }
    });
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/30">
            Super Admin
          </span>
        );
      case 'LIBRARIAN':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/30">
            Librarian
          </span>
        );
      case 'RECEPTIONIST':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
            Receptionist
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
            Student
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-red-500" />
            Global User & Identity Directory
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Browse across students, librarians, reception staff, and root admins across the platform.
          </p>
        </div>
      </div>

      {/* Controls: Search & Role Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Role Filters */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
          {(['ALL', 'STUDENT', 'LIBRARIAN', 'RECEPTIONIST', 'ADMIN'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                roleFilter === r
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {r === 'ALL' ? 'All Roles' : r}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, RFID, ID..."
            className="w-full h-10 pl-10 pr-4 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5 font-semibold">User</th>
                <th className="px-5 py-3.5 font-semibold">Contact & Phone</th>
                <th className="px-5 py-3.5 font-semibold">Role</th>
                <th className="px-5 py-3.5 font-semibold">KYC / DigiLocker</th>
                <th className="px-5 py-3.5 font-semibold">Wallet & Activity</th>
                <th className="px-5 py-3.5 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-slate-100">{u.name}</div>
                    <div className="text-[11px] font-mono text-slate-500">
                      ID: {u.uniqueId || 'No ID'}
                      {u.rfidTag && (
                        <span className="ml-2 text-purple-400">RFID: {u.rfidTag}</span>
                      )}
                    </div>
                  </td>

                  <td className="px-5 py-3.5">
                    <div className="text-slate-200 font-mono">{u.phone || 'No phone'}</div>
                    {u.email && <div className="text-[11px] text-slate-400">{u.email}</div>}
                  </td>

                  <td className="px-5 py-3.5">{getRoleBadge(u.role)}</td>

                  <td className="px-5 py-3.5">
                    {u.digilockerVerified ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                      </span>
                    ) : (
                      <span className="text-slate-500 flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" /> Unverified
                      </span>
                    )}
                  </td>

                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-300 font-medium">₹{u.walletBalance}</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-amber-400 flex items-center gap-0.5">
                        <Flame className="w-3 h-3" /> {u.currentStreak}d
                      </span>
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-400">{u._count.bookings} bks</span>
                    </div>
                  </td>

                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => setSelectedUser(u)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                    No users matched your search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over / Modal: Manage User */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white text-lg">{selectedUser.name}</h3>
                <p className="text-xs text-slate-400">FocusX ID: {selectedUser.uniqueId || 'N/A'}</p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Meta Summary */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-500">Phone:</span>{' '}
                <span className="text-slate-200 font-mono font-medium">{selectedUser.phone || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500">Email:</span>{' '}
                <span className="text-slate-200">{selectedUser.email || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500">RFID Tag:</span>{' '}
                <span className="text-purple-400 font-mono font-semibold">{selectedUser.rfidTag || 'None'}</span>
              </div>
              <div>
                <span className="text-slate-500">DigiLocker:</span>{' '}
                <span className={selectedUser.digilockerVerified ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                  {selectedUser.digilockerVerified ? 'Verified' : 'Pending'}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Wallet Balance:</span>{' '}
                <span className="text-slate-200 font-bold">₹{selectedUser.walletBalance}</span>
              </div>
              <div>
                <span className="text-slate-500">Total Bookings:</span>{' '}
                <span className="text-slate-200 font-medium">{selectedUser._count.bookings}</span>
              </div>
            </div>

            {/* Role Privilege Changer */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                Assign System Role
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['STUDENT', 'LIBRARIAN', 'RECEPTIONIST', 'ADMIN'] as const).map((r) => (
                  <button
                    key={r}
                    disabled={isPending || selectedUser.id === currentAdminId && r !== 'ADMIN'}
                    onClick={() => handleRoleChange(selectedUser.id, r)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all border text-left flex items-center justify-between ${
                      selectedUser.role === r
                        ? 'bg-red-600/20 text-red-300 border-red-500/40 shadow-sm'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <span>{r}</span>
                    {selectedUser.role === r && <CheckCircle2 className="w-3.5 h-3.5 text-red-400" />}
                  </button>
                ))}
              </div>
              {selectedUser.id === currentAdminId && (
                <p className="text-[11px] text-amber-400">
                  You cannot demote your own active Super Admin session.
                </p>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
