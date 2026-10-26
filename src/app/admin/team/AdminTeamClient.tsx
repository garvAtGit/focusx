'use client';

import { useState, useTransition } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Trash2,
  Phone,
  Mail,
  Lock,
  Loader2,
  X,
  Info,
  Check,
  Edit2,
  Sliders,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import {
  createOrPromoteAdmin,
  revokeAdminRole,
  updateAdminPermissions,
} from '@/app/actions/admin-actions';
import toast from 'react-hot-toast';

export interface AdminAuthority {
  id: string;
  name: string;
  description: string;
  badge: string;
  color: string;
}

export const ADMIN_AUTHORITIES: AdminAuthority[] = [
  {
    id: 'APPROVE_KYC',
    name: 'Approve & Reject KYC',
    description: 'Can review, approve, and reject library onboardings & bank documents',
    badge: 'KYC Approver',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    id: 'EDIT_LIBRARIES',
    name: 'Edit Libraries & Pricing',
    description: 'Can modify library profile, seat layouts, plans, and facility settings',
    badge: 'Library Editor',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    id: 'MANAGE_USERS',
    name: 'Manage Students & Users',
    description: 'Can view/edit student profiles, adjust roles, and verify accounts',
    badge: 'User Manager',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    id: 'MANAGE_HARDWARE',
    name: 'IoT Fleet & Machines',
    description: 'Can claim hardware, configure door relays, and ping scanners',
    badge: 'IoT Admin',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    id: 'VIEW_FINANCIALS',
    name: 'Ledger & Financials',
    description: 'Can inspect platform revenue, bookings ledger, and transaction IDs',
    badge: 'Financials',
    color: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  },
  {
    id: 'READ_ONLY',
    name: 'Read-Only Observer (Only See)',
    description: 'Can inspect all pages and data, but CANNOT approve, reject, edit, or delete',
    badge: 'Read-Only (View Only)',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
  },
];

interface AdminUser {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  uniqueId: string | null;
  adminPermissions?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export function AdminTeamClient({
  initialAdmins,
  currentAdminId,
}: {
  initialAdmins: AdminUser[];
  currentAdminId: string;
}) {
  const [admins, setAdmins] = useState<AdminUser[]>(initialAdmins);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Form fields for new admin
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [preset, setPreset] = useState<'FULL' | 'KYC' | 'OPS' | 'READ_ONLY' | 'CUSTOM'>('FULL');

  const applyPreset = (type: 'FULL' | 'KYC' | 'OPS' | 'READ_ONLY' | 'CUSTOM') => {
    setPreset(type);
    if (type === 'FULL') {
      setSelectedPermissions([]); // Empty or FULL_ACCESS represents full super admin
    } else if (type === 'KYC') {
      setSelectedPermissions(['APPROVE_KYC']);
    } else if (type === 'OPS') {
      setSelectedPermissions(['EDIT_LIBRARIES', 'MANAGE_USERS', 'MANAGE_HARDWARE']);
    } else if (type === 'READ_ONLY') {
      setSelectedPermissions(['READ_ONLY']);
    }
  };

  const togglePermission = (permId: string) => {
    setPreset('CUSTOM');
    setSelectedPermissions((prev) => {
      // If toggling READ_ONLY, remove conflicting write permissions
      if (permId === 'READ_ONLY') {
        return prev.includes('READ_ONLY') ? [] : ['READ_ONLY'];
      }
      // If adding any write permission, remove READ_ONLY
      const withoutReadOnly = prev.filter((p) => p !== 'READ_ONLY');
      if (withoutReadOnly.includes(permId)) {
        return withoutReadOnly.filter((p) => p !== permId);
      }
      return [...withoutReadOnly, permId];
    });
  };

  const toggleEditPermission = (permId: string) => {
    setEditPermissions((prev) => {
      if (permId === 'READ_ONLY') {
        return prev.includes('READ_ONLY') ? [] : ['READ_ONLY'];
      }
      const withoutReadOnly = prev.filter((p) => p !== 'READ_ONLY');
      if (withoutReadOnly.includes(permId)) {
        return withoutReadOnly.filter((p) => p !== permId);
      }
      return [...withoutReadOnly, permId];
    });
  };

  const handleCreateAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || phone.replace(/\D/g, '').length < 10) {
      toast.error('Please enter a valid name and 10-digit mobile number');
      return;
    }

    const formData = new FormData();
    formData.append('name', name.trim());
    formData.append('phone', phone.trim());
    if (email.trim()) formData.append('email', email.trim());
    formData.append('permissions', JSON.stringify(selectedPermissions));

    startTransition(async () => {
      try {
        await createOrPromoteAdmin(formData);
        toast.success(`Admin access granted to ${name}!`);
        setModalOpen(false);
        setName('');
        setPhone('');
        setEmail('');
        setSelectedPermissions([]);
        setPreset('FULL');

        const cleanPhone = phone.replace(/\D/g, '').slice(-10);
        setAdmins((prev) => [
          ...prev.filter((a) => a.phone !== `+91${cleanPhone}`),
          {
            id: 'temp-' + Date.now(),
            name: name.trim(),
            phone: `+91${cleanPhone}`,
            email: email.trim() || null,
            uniqueId: 'NEW',
            adminPermissions: selectedPermissions,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to add admin');
      }
    });
  };

  const handleSaveEditPermissions = () => {
    if (!editingAdmin) return;

    startTransition(async () => {
      try {
        await updateAdminPermissions(editingAdmin.id, editPermissions);
        setAdmins((prev) =>
          prev.map((a) =>
            a.id === editingAdmin.id
              ? { ...a, adminPermissions: editPermissions }
              : a
          )
        );
        toast.success(`Authorities updated for ${editingAdmin.name}!`);
        setEditingAdmin(null);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to update authorities');
      }
    });
  };

  const handleRevoke = (adminId: string, adminName: string) => {
    if (adminId === currentAdminId) {
      toast.error('You cannot revoke your own Super Admin access.');
      return;
    }

    if (!confirm(`Are you sure you want to revoke Super Admin privileges from ${adminName}?`)) {
      return;
    }

    setRevokingId(adminId);
    startTransition(async () => {
      try {
        await revokeAdminRole(adminId);
        setAdmins((prev) => prev.filter((a) => a.id !== adminId));
        toast.success(`Super Admin access revoked from ${adminName}.`);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to revoke admin');
      } finally {
        setRevokingId(null);
      }
    });
  };

  const renderAuthorityBadges = (perms?: string[]) => {
    if (!perms || perms.length === 0 || perms.includes('FULL_ACCESS')) {
      return (
        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
          Full Super Admin
        </span>
      );
    }

    if (perms.includes('READ_ONLY')) {
      return (
        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
          Read-Only (View Only)
        </span>
      );
    }

    return (
      <div className="flex flex-wrap gap-1 max-w-[280px]">
        {perms.map((p) => {
          const matched = ADMIN_AUTHORITIES.find((a) => a.id === p);
          return (
            <span
              key={p}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                matched ? matched.color : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              {matched ? matched.badge : p}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 font-sans pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-black tracking-wider uppercase px-2.5 py-1 rounded-full bg-blue-50 text-[#2781CA] border border-blue-100">
              FocusX Governance
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-[#2781CA]" />
            Administrative Team & Authorities
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Manage who has access to the FocusX HQ Command Center and assign granular authority scopes (e.g. KYC approval, editing, or read-only).
          </p>
        </div>

        <button
          onClick={() => {
            setPreset('FULL');
            setSelectedPermissions([]);
            setModalOpen(true);
          }}
          className="h-11 px-5 rounded-2xl bg-[#2781CA] hover:bg-[#1f6ca8] text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 self-start md:self-auto shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          Authorize New Admin
        </button>
      </div>

      {/* Info Notice */}
      <div className="p-5 rounded-2xl bg-blue-50/60 border border-blue-100/80 text-blue-900 flex items-start gap-3.5">
        <Info className="w-5 h-5 text-[#2781CA] shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed">
          <span className="font-bold">Role-Based Access Guard:</span> Admins can be granted Full Super Admin access, custom authorities (like KYC approvals or library management), or Read-Only mode. All actions are logged and authenticated via OTP.
        </div>
      </div>

      {/* Admin Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 text-slate-500 font-bold border-b border-slate-200/80">
              <tr>
                <th className="px-6 py-4 font-black uppercase text-[11px] tracking-wider">Admin Name</th>
                <th className="px-6 py-4 font-black uppercase text-[11px] tracking-wider">Phone / Login</th>
                <th className="px-6 py-4 font-black uppercase text-[11px] tracking-wider">Email</th>
                <th className="px-6 py-4 font-black uppercase text-[11px] tracking-wider">FocusX ID</th>
                <th className="px-6 py-4 font-black uppercase text-[11px] tracking-wider">Authority Scope</th>
                <th className="px-6 py-4 font-black uppercase text-[11px] tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {admins.map((adm) => {
                const isSelf = adm.id === currentAdminId;
                const isCurrentRevoking = revokingId === adm.id;

                return (
                  <tr key={adm.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center font-black text-slate-700 text-xs shrink-0">
                          {adm.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-black text-slate-900 flex items-center gap-2">
                            {adm.name}
                            {isSelf && (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Authorized:{' '}
                            {new Date(adm.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className="font-mono text-slate-800 font-bold flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {adm.phone || 'No phone'}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      {adm.email ? (
                        <span className="text-slate-600 font-medium flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {adm.email}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Not set</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <span className="font-mono text-xs text-slate-700 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200">
                        {adm.uniqueId || 'N/A'}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      {renderAuthorityBadges(adm.adminPermissions)}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingAdmin(adm);
                            setEditPermissions(adm.adminPermissions || []);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5"
                          title="Edit admin authority"
                        >
                          <Sliders className="w-3.5 h-3.5 text-slate-500" />
                          Authorities
                        </button>

                        {!isSelf && (
                          <button
                            disabled={isCurrentRevoking}
                            onClick={() => handleRevoke(adm.id, adm.name)}
                            className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {isCurrentRevoking ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Authorize New Admin */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200/80 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#2781CA] border border-blue-100 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Authorize New Admin</h3>
                  <p className="text-xs text-slate-500 font-medium">Configure credentials and assign authority scope</p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Admin Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full h-11 px-4 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2781CA] focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Mobile Number (Used for OTP Login) *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold font-mono">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    value={phone.replace(/^\+91/, '')}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="98765 43210"
                    className="w-full h-11 pl-12 pr-4 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2781CA] focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@focusx.com"
                  className="w-full h-11 px-4 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2781CA] focus:bg-white transition-all"
                />
              </div>

              {/* Authority Selection */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Authority Scope & Permissions
                  </label>
                  <span className="text-[11px] text-slate-500 font-medium">Select preset or customize</span>
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => applyPreset('FULL')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      preset === 'FULL'
                        ? 'bg-red-50 border-red-300 text-red-800 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-[11px] font-black">Full Admin</div>
                    <div className="text-[10px] text-slate-500 font-medium mt-0.5">All powers</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPreset('KYC')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      preset === 'KYC'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-[11px] font-black">KYC Approver</div>
                    <div className="text-[10px] text-slate-500 font-medium mt-0.5">KYC only</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPreset('OPS')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      preset === 'OPS'
                        ? 'bg-blue-50 border-blue-300 text-blue-800 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-[11px] font-black">Operations</div>
                    <div className="text-[10px] text-slate-500 font-medium mt-0.5">Libraries & Users</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPreset('READ_ONLY')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      preset === 'READ_ONLY'
                        ? 'bg-purple-50 border-purple-300 text-purple-800 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-[11px] font-black">Read-Only</div>
                    <div className="text-[10px] text-slate-500 font-medium mt-0.5">Only see</div>
                  </button>
                </div>

                {/* Individual Checkboxes */}
                <div className="space-y-2 mt-3 pt-2">
                  {ADMIN_AUTHORITIES.map((auth) => {
                    const isChecked =
                      preset === 'FULL'
                        ? true
                        : selectedPermissions.includes(auth.id);

                    return (
                      <label
                        key={auth.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-blue-50/40 border-blue-200'
                            : 'bg-white border-slate-200/80 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={preset === 'FULL'}
                          onChange={() => togglePermission(auth.id)}
                          className="mt-0.5 w-4 h-4 rounded text-[#2781CA] focus:ring-[#2781CA] border-slate-300"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{auth.name}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.2 rounded ${auth.color}`}>
                              {auth.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{auth.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !name.trim() || phone.replace(/\D/g, '').length < 10}
                  className="px-5 py-2.5 rounded-xl bg-[#2781CA] hover:bg-[#1f6ca8] text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  Confirm & Authorize
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Existing Admin Authorities */}
      {editingAdmin && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200/80 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 border border-purple-100 flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Edit Authorities: {editingAdmin.name}</h3>
                  <p className="text-xs text-slate-500 font-medium">Adjust what this admin is authorized to do</p>
                </div>
              </div>
              <button
                onClick={() => setEditingAdmin(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 pt-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex items-center justify-between">
                <span className="text-slate-600 font-medium">Phone: <strong className="text-slate-900">{editingAdmin.phone}</strong></span>
                <span className="text-slate-600 font-medium">ID: <strong className="font-mono text-slate-900">{editingAdmin.uniqueId}</strong></span>
              </div>

              {/* Quick Preset Buttons for Editing */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setEditPermissions([])}
                  className={`p-2 rounded-xl border text-center text-xs font-bold transition-all ${
                    editPermissions.length === 0
                      ? 'bg-red-50 border-red-300 text-red-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Full Super Admin
                </button>
                <button
                  type="button"
                  onClick={() => setEditPermissions(['APPROVE_KYC'])}
                  className={`p-2 rounded-xl border text-center text-xs font-bold transition-all ${
                    editPermissions.length === 1 && editPermissions[0] === 'APPROVE_KYC'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  KYC Only
                </button>
                <button
                  type="button"
                  onClick={() => setEditPermissions(['READ_ONLY'])}
                  className={`p-2 rounded-xl border text-center text-xs font-bold transition-all ${
                    editPermissions.includes('READ_ONLY')
                      ? 'bg-slate-200 border-slate-400 text-slate-900'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Read-Only (Only See)
                </button>
              </div>

              <div className="space-y-2 pt-2">
                {ADMIN_AUTHORITIES.map((auth) => {
                  const isChecked =
                    editPermissions.length === 0
                      ? true
                      : editPermissions.includes(auth.id);

                  return (
                    <label
                      key={auth.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-blue-50/40 border-blue-200'
                          : 'bg-white border-slate-200/80 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleEditPermission(auth.id)}
                        className="mt-0.5 w-4 h-4 rounded text-[#2781CA] focus:ring-[#2781CA] border-slate-300"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{auth.name}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.2 rounded ${auth.color}`}>
                            {auth.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{auth.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingAdmin(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleSaveEditPermissions}
                  className="px-5 py-2.5 rounded-xl bg-[#2781CA] hover:bg-[#1f6ca8] text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save Authorities
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
