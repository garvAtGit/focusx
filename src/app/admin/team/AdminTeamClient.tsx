'use client';

import { useState, useTransition } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Trash2,
  Phone,
  Mail,
  Calendar,
  Lock,
  Loader2,
  X,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { createOrPromoteAdmin, revokeAdminRole } from '@/app/actions/admin-actions';
import toast from 'react-hot-toast';

interface AdminUser {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  uniqueId: string | null;
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
  const [isPending, startTransition] = useTransition();
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

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

    startTransition(async () => {
      try {
        await createOrPromoteAdmin(formData);
        toast.success(`Admin access granted to ${name}!`);
        setModalOpen(false);
        setName('');
        setPhone('');
        setEmail('');
        // Optimistically update list
        const cleanPhone = phone.replace(/\D/g, '').slice(-10);
        setAdmins((prev) => [
          ...prev.filter((a) => a.phone !== `+91${cleanPhone}`),
          {
            id: 'temp-' + Date.now(),
            name: name.trim(),
            phone: `+91${cleanPhone}`,
            email: email.trim() || null,
            uniqueId: 'NEW',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to add admin');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-red-500" />
            Super Admin Team Governance
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Manage root administrators, authorize new operations team members, and revoke credentials.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-xs transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 self-start md:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          Authorize New Admin
        </button>
      </div>

      {/* Info notice */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-start gap-3">
        <Info className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-white">How Admin Authorization Works:</span> When you authorize a phone number below, the system gives them root <code className="text-red-400 bg-red-500/10 px-1 py-0.5 rounded font-mono">ADMIN</code> role. They can immediately log in through <code className="text-red-400 bg-red-500/10 px-1 py-0.5 rounded font-mono">/admin/login</code> with SMS OTP verification. Numbers listed in <code className="text-slate-200 bg-slate-800 px-1 py-0.5 rounded font-mono">ADMIN_PHONES</code> in environment variables also receive automatic elevation.
        </div>
      </div>

      {/* Admins Table */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Administrator</th>
                <th className="px-5 py-3.5 font-semibold">Phone Number</th>
                <th className="px-5 py-3.5 font-semibold">Email</th>
                <th className="px-5 py-3.5 font-semibold">FocusX ID</th>
                <th className="px-5 py-3.5 font-semibold">Role & Access</th>
                <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {admins.map((adm) => {
                const isSelf = adm.id === currentAdminId;
                const isCurrentRevoking = revokingId === adm.id && isPending;
                return (
                  <tr key={adm.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center font-bold text-xs">
                          {adm.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                            {adm.name}
                            {isSelf && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 font-bold uppercase tracking-wider">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
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

                    <td className="px-5 py-4">
                      <span className="font-mono text-slate-200 font-medium flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-500" />
                        {adm.phone || 'No phone'}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      {adm.email ? (
                        <span className="text-slate-300 flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-slate-500" />
                          {adm.email}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">Not set</span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <span className="font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                        {adm.uniqueId || 'N/A'}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/30">
                        Super Admin
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      {isSelf ? (
                        <span className="text-[11px] text-slate-500 italic">Active Session</span>
                      ) : (
                        <button
                          disabled={isCurrentRevoking}
                          onClick={() => handleRevoke(adm.id, adm.name)}
                          className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold transition-colors flex items-center gap-1 ml-auto disabled:opacity-50"
                        >
                          {isCurrentRevoking ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          Revoke Access
                        </button>
                      )}
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Authorize New Super Admin</h3>
                  <p className="text-xs text-slate-400">Grant platform-wide root administrative powers</p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                  Admin Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full h-10 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                  Mobile Number (Used for OTP Login) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    value={phone.replace(/^\+91/, '')}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="98765 43210"
                    className="w-full h-10 pl-12 pr-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  This person will use this mobile number at <code>/admin/login</code> to receive OTP.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@focusx.com"
                  className="w-full h-10 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !name.trim() || phone.replace(/\D/g, '').length < 10}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-all shadow-md shadow-red-600/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  Confirm & Authorize
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
