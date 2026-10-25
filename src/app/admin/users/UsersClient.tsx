'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Flame,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  FilterX,
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

interface UsersClientProps {
  initialUsers: UserRecord[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  currentRole: 'ALL' | Role;
  initialQuery: string;
  currentAdminId: string;
}

export function UsersClient({
  initialUsers,
  totalCount,
  currentPage,
  pageSize,
  currentRole,
  initialQuery,
  currentAdminId,
}: UsersClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [users, setUsers] = useState<UserRecord[]>(initialUsers);
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [isPending, startTransition] = useTransition();

  // Keep local user records in sync with server revalidations
  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  // Keep search input in sync if URL changes externally (e.g. back/forward navigation)
  useEffect(() => {
    setSearchInput(initialQuery);
  }, [initialQuery]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // URL navigation helper
  const updateUrl = useCallback(
    (updates: { page?: number; q?: string; role?: 'ALL' | Role }) => {
      const params = new URLSearchParams(searchParams.toString());

      const nextQ = updates.q !== undefined ? updates.q.trim() : searchInput.trim();
      const nextRole = updates.role !== undefined ? updates.role : currentRole;
      const nextPage = updates.page !== undefined ? updates.page : 1;

      if (nextQ) {
        params.set('q', nextQ);
      } else {
        params.delete('q');
      }

      if (nextRole && nextRole !== 'ALL') {
        params.set('role', nextRole);
      } else {
        params.delete('role');
      }

      if (nextPage > 1) {
        params.set('page', nextPage.toString());
      } else {
        params.delete('page');
      }

      const queryString = params.toString();
      const targetUrl = queryString ? `${pathname}?${queryString}` : pathname;

      startTransition(() => {
        router.push(targetUrl, { scroll: false });
      });
    },
    [pathname, searchParams, searchInput, currentRole, router]
  );

  // Debounced search effect (350ms)
  useEffect(() => {
    if (searchInput.trim() === initialQuery.trim()) return;

    const timer = setTimeout(() => {
      updateUrl({ q: searchInput, page: 1 });
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput, initialQuery, updateUrl]);

  const handleClearSearch = () => {
    setSearchInput('');
    updateUrl({ q: '', page: 1 });
  };

  const handleRoleSelect = (role: 'ALL' | Role) => {
    updateUrl({ role, page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    updateUrl({ page: newPage });
  };

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
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
            Super Admin
          </span>
        );
      case 'LIBRARIAN':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-[#2781CA] border border-blue-200">
            Librarian
          </span>
        );
      case 'RECEPTIONIST':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
            Receptionist
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
            Student
          </span>
        );
    }
  };

  // Generate pagination items
  const renderPaginationItems = () => {
    const items: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) items.push(i);
    } else {
      if (currentPage <= 4) {
        items.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 3) {
        items.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        items.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }

    return items.map((item, idx) => {
      if (item === '...') {
        return (
          <span key={`ellipsis-${idx}`} className="px-2 text-slate-400 font-bold select-none text-xs">
            ...
          </span>
        );
      }
      const pageNum = item as number;
      const isActive = pageNum === currentPage;
      return (
        <button
          key={`page-${pageNum}`}
          onClick={() => handlePageChange(pageNum)}
          disabled={isPending}
          className={`min-w-9 h-9 px-3 rounded-xl text-xs font-bold transition-all ${
            isActive
              ? 'bg-[#2781CA] text-white shadow-[0_2px_10px_-4px_rgba(39,129,202,0.5)]'
              : 'bg-slate-100/80 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          {pageNum}
        </button>
      );
    });
  };

  const startEntry = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endEntry = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="space-y-6 font-sans pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-black tracking-wider uppercase px-2.5 py-1 rounded-full bg-blue-50 text-[#2781CA] border border-blue-100">
              FocusX User Directory
            </span>
            <span className="text-[11px] font-bold text-slate-400">
              {totalCount.toLocaleString()} Total Users
            </span>
          </div>
          <h1 className="text-[28px] font-black text-slate-900 tracking-tight leading-none flex items-center gap-2.5">
            <Users className="w-7 h-7 text-[#2781CA]" />
            Global User & Identity Directory
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-2">
            Browse across students, librarians, reception staff, and root admins across the platform.
          </p>
        </div>
      </div>

      {/* Controls: Search & Role Filters */}
      <div className="p-4 rounded-3xl bg-white border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Role Filters */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {(['ALL', 'STUDENT', 'LIBRARIAN', 'RECEPTIONIST', 'ADMIN'] as const).map((r) => (
            <button
              key={r}
              onClick={() => handleRoleSelect(r)}
              disabled={isPending}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                currentRole === r
                  ? 'bg-[#2781CA] text-white shadow-[0_2px_10px_-4px_rgba(39,129,202,0.5)]'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {r === 'ALL' ? 'All Roles' : r}
            </button>
          ))}
        </div>

        {/* Global Search across all pages */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                updateUrl({ q: searchInput, page: 1 });
              }
            }}
            placeholder="Search across all pages (name, phone, RFID)..."
            className="w-full h-11 pl-11 pr-10 bg-slate-50/70 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2781CA] focus:bg-white transition-all"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#2781CA]" />
            ) : searchInput ? (
              <button
                onClick={handleClearSearch}
                aria-label="Clear search"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Table & Pagination Wrapper */}
      <div className="rounded-[2.5rem] bg-white border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200/80">
              <tr>
                <th className="px-6 py-4 font-black uppercase text-[11px] tracking-wider">User</th>
                <th className="px-6 py-4 font-black uppercase text-[11px] tracking-wider">Contact & Phone</th>
                <th className="px-6 py-4 font-black uppercase text-[11px] tracking-wider">Role</th>
                <th className="px-6 py-4 font-black uppercase text-[11px] tracking-wider">KYC / DigiLocker</th>
                <th className="px-6 py-4 font-black uppercase text-[11px] tracking-wider">Wallet & Activity</th>
                <th className="px-6 py-4 font-black uppercase text-[11px] tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{u.name}</div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      ID: {u.uniqueId || 'No ID'}
                      {u.rfidTag && (
                        <span className="ml-2 text-purple-600 font-semibold">RFID: {u.rfidTag}</span>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-slate-800 font-mono font-bold">{u.phone || 'No phone'}</div>
                    {u.email && <div className="text-[11px] text-slate-400">{u.email}</div>}
                  </td>

                  <td className="px-6 py-4">{getRoleBadge(u.role)}</td>

                  <td className="px-6 py-4">
                    {u.digilockerVerified ? (
                      <span className="text-emerald-700 flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Verified
                      </span>
                    ) : (
                      <span className="text-slate-400 flex items-center gap-1 font-medium">
                        <XCircle className="w-3.5 h-3.5" /> Unverified
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-900 font-bold">₹{u.walletBalance}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-amber-600 font-bold flex items-center gap-0.5">
                        <Flame className="w-3.5 h-3.5 text-amber-500" /> {u.currentStreak}d
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-500 font-medium">{u._count.bookings} bks</span>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setSelectedUser(u)}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-14 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                        <FilterX className="w-6 h-6" />
                      </div>
                      <div className="font-bold text-slate-800 text-sm">No users found</div>
                      <p className="text-xs text-slate-400">
                        {searchInput
                          ? `No users matched "${searchInput}" across all records in the directory.`
                          : 'No users found for this role filter.'}
                      </p>
                      {(searchInput || currentRole !== 'ALL') && (
                        <button
                          onClick={() => {
                            setSearchInput('');
                            updateUrl({ q: '', role: 'ALL', page: 1 });
                          }}
                          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                        >
                          Clear Filters & Search
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Controls */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs font-medium text-slate-500">
            Showing <span className="font-bold text-slate-900">{startEntry}</span> to{' '}
            <span className="font-bold text-slate-900">{endEntry}</span> of{' '}
            <span className="font-bold text-slate-900">{totalCount.toLocaleString()}</span> users
          </div>

          <div className="flex items-center gap-2">
            {/* Previous */}
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || isPending}
              className="flex items-center gap-1 px-3.5 h-9 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">{renderPaginationItems()}</div>

            {/* Next */}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || isPending}
              className="flex items-center gap-1 px-3.5 h-9 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Slide-over / Modal: Manage User */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200/80 rounded-3xl p-6 shadow-2xl relative space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-black text-slate-900 text-lg">{selectedUser.name}</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">FocusX ID: {selectedUser.uniqueId || 'N/A'}</p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Meta Summary */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px]">Phone:</span>{' '}
                <span className="text-slate-900 font-mono font-bold">{selectedUser.phone || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px]">Email:</span>{' '}
                <span className="text-slate-900 font-medium">{selectedUser.email || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px]">RFID Tag:</span>{' '}
                <span className="text-purple-600 font-mono font-bold">{selectedUser.rfidTag || 'None'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px]">DigiLocker:</span>{' '}
                <span className={selectedUser.digilockerVerified ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                  {selectedUser.digilockerVerified ? 'Verified' : 'Pending'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px]">Wallet:</span>{' '}
                <span className="text-slate-900 font-bold">₹{selectedUser.walletBalance}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px]">Bookings:</span>{' '}
                <span className="text-slate-900 font-bold">{selectedUser._count.bookings}</span>
              </div>
            </div>

            {/* Role Privilege Changer */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-900 uppercase tracking-wide">
                Assign System Role
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {(['STUDENT', 'LIBRARIAN', 'RECEPTIONIST', 'ADMIN'] as const).map((r) => (
                  <button
                    key={r}
                    disabled={isPending || (selectedUser.id === currentAdminId && r !== 'ADMIN')}
                    onClick={() => handleRoleChange(selectedUser.id, r)}
                    className={`py-2.5 px-3.5 rounded-xl text-xs font-bold transition-all border text-left flex items-center justify-between ${
                      selectedUser.role === r
                        ? 'bg-[#2781CA] text-white border-[#2781CA] shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>{r}</span>
                    {selectedUser.role === r && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </button>
                ))}
              </div>
              {selectedUser.id === currentAdminId && (
                <p className="text-[11px] text-amber-600 font-medium">
                  You cannot demote your own active Super Admin session.
                </p>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
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
