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
    <div className="space-y-6 font-sans pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-black tracking-wider uppercase px-2.5 py-1 rounded-full bg-blue-50 text-[#2781CA] border border-blue-100">
              FocusX Governance
            </span>
          </div>
          <h1 className="text-[28px] font-black text-slate-900 tracking-tight leading-none flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-[#2781CA]" />
            Super Admin Team Governance
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-2">
            Manage root administrators, authorize new operations team members, and revoke credentials.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="px-5 py-2.5 rounded-xl bg-[#2781CA] hover:opacity-90 text-white font-bold text-xs transition-all shadow-[0_2px_10px_-4px_rgba(39,129,202,0.5)] flex items-center justify-center gap-2 self-start md:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          Authorize New Admin
        </button>
      </div>

      {/* Info notice */}
      <div className="p-5 rounded-3xl bg-blue-50/60 border border-blue-100 text-xs text-slate-700 flex items-start gap-3.5 shadow-sm">
        <Info className="w-5 h-5 text-[#2781CA] shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold text-slate-900">How Admin Authorization Works:</span> When you authorize a phone number below, the system gives them root <code className="text-[#2781CA] bg-blue-100/70 px-1.5 py-0.5 rounded font-mono font-bold">ADMIN</code> role. They can immediately log in through <code className="text-[#2781CA] bg-blue-100/70 px-1.5 py-0.5 rounded font-mono font-bold">/admin/login</code> with SMS OTP verification. Numbers listed in <code className="text-slate-800 bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono font-bold">ADMIN_PHONES</code> in environment variables also receive automatic elevation.
        </div>
      </div>

      {/* Admins Table */}
      <div className="rounded-[2.5rem] bg-white border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200/80">
              <tr>
                <th className="px-6 py-4 font-black uppercase text-[11px] tracking-wider">Administrator</th>
                <th className="px-6 py-4 font-black uppercase text-[11px] tracking-wider">Phone Number</th>
                <th className="px-6 py-4 font-black uppercase text-[11px] tracking-wider">Email</th>
                <th className="px-6 py-4 font-black uppercase text-[11px] tracking-wider">FocusX ID</th>
                <th className="px-6 py-4 font-black uppercase text-[11px] tracking-wider">Role & Access</th>
                <th className="px-6 py-4 font-black uppercase text-[11px] tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {admins.map((adm) => {
                const isSelf = adm.id === currentAdminId;
                const isCurrentRevoking = revokingId === adm.id && isPending;
                return (
                  <tr key={adm.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#2781CA] border border-blue-100 flex items-center justify-center font-bold text-xs shadow-xs">
                          {adm.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            {adm.name}
                            {isSelf && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-[#2781CA] border border-blue-200 font-bold uppercase tracking-wider">
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
                      <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
                        Super Admin
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      {isSelf ? (
                        <span className="text-xs text-slate-400 italic font-medium">Active Session</span>
                      ) : (
                        <button
                          disabled={isCurrentRevoking}
                          onClick={() => handleRevoke(adm.id, adm.name)}
                          className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold transition-colors flex items-center gap-1.5 ml-auto disabled:opacity-50"
                        >
                          {isCurrentRevoking ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-3xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#2781CA] border border-blue-100 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Authorize New Super Admin</h3>
                  <p className="text-xs text-slate-500 font-medium">Grant platform-wide root administrative powers</p>
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
                <p className="text-[11px] text-slate-500">
                  This person will use this mobile number at <code>/admin/login</code> to receive OTP.
                </p>
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

              <div className="pt-2 flex items-center justify-end gap-3">
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
                  className="px-5 py-2.5 rounded-xl bg-[#2781CA] hover:opacity-90 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2"
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
