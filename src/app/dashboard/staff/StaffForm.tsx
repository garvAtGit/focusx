'use client'

import { useState } from "react";
import { addStaffMember } from "@/app/actions/staff-actions";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Check,
  ShieldCheck,
  Sparkles,
  Info,
  CheckSquare,
  Square,
} from "lucide-react";
import { initializeApp, getApps } from "firebase/app"
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth"
import { firebaseConfig } from "@/lib/firebase/clientApp"
import toast from "react-hot-toast"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  PERMISSION_GROUPS,
  ROLE_PRESETS,
  ALL_PERMISSIONS,
} from "@/lib/permissions-registry"
import type { StaffRole } from "@prisma/client"

declare global {
  interface Window {
    staffRecaptchaVerifier?: RecaptchaVerifier | null;
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

interface StaffFormProps {
  libraryName?: string;
}

export function StaffForm({ libraryName }: StaffFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("RECEPTIONIST");
  const [customRoleName, setCustomRoleName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
    ROLE_PRESETS.RECEPTIONIST
  );
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    students: true,
    bookings: true,
  });

  // OTP States
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState("+91 ");
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [verificationObj, setVerificationObj] = useState<ConfirmationResult | null>(null);
  const [verifiedIdToken, setVerifiedIdToken] = useState<string | null>(null);

  // Toggle role template
  const handleRoleChange = (newRole: StaffRole) => {
    setRole(newRole);
    if (newRole === "RECEPTIONIST") {
      setSelectedPermissions(ROLE_PRESETS.RECEPTIONIST);
    } else if (newRole === "MANAGER") {
      setSelectedPermissions(ROLE_PRESETS.MANAGER);
    }
  };

  const togglePermission = (permId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const toggleGroupAll = (groupKey: string) => {
    const group = PERMISSION_GROUPS.find((g) => g.key === groupKey);
    if (!group) return;
    const groupPermIds = group.permissions.map((p) => p.id);
    const allSelected = groupPermIds.every((id) => selectedPermissions.includes(id));

    if (allSelected) {
      setSelectedPermissions((prev) => prev.filter((id) => !groupPermIds.includes(id)));
    } else {
      setSelectedPermissions((prev) => Array.from(new Set([...prev, ...groupPermIds])));
    }
  };

  const toggleGroupExpand = (groupKey: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const selectAllPermissions = () => {
    setSelectedPermissions(ALL_PERMISSIONS);
  };

  const clearAllPermissions = () => {
    setSelectedPermissions([]);
  };

  const handleSendOTP = async () => {
    try {
      setOtpLoading(true);
      setError(null);
      const secondaryApp =
        getApps().find((app) => app.name === 'Secondary') ||
        initializeApp(firebaseConfig, 'Secondary');
      const secondaryAuth = getAuth(secondaryApp);

      const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;

      if (window.staffRecaptchaVerifier) {
        try {
          window.staffRecaptchaVerifier.clear();
        } catch {}
        window.staffRecaptchaVerifier = null;
      }

      const appVerifier = new RecaptchaVerifier(secondaryAuth, 'staff-recaptcha', {
        size: 'invisible',
      });
      window.staffRecaptchaVerifier = appVerifier;

      const confirmation = await signInWithPhoneNumber(secondaryAuth, formattedPhone, appVerifier);

      setVerificationObj(confirmation);
      setStep(2);
      toast.success('OTP sent successfully!');
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, "Failed to send OTP"));
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!verificationObj) {
      setError("Please request a new OTP.");
      return;
    }

    try {
      setOtpLoading(true);
      setError(null);
      const result = await verificationObj.confirm(otp);
      const token = await result.user.getIdToken();
      setVerifiedIdToken(token);
      const secondaryApp = getApps().find((app) => app.name === 'Secondary');
      if (secondaryApp) {
        await getAuth(secondaryApp).signOut();
      }
      toast.success("Phone verified!");
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, "Invalid OTP"));
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!verifiedIdToken) {
      setError("Please verify the staff's phone number first.");
      return;
    }

    if (selectedPermissions.length === 0) {
      setError("Please select at least one permission for this staff member.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("phone", phone);
    formData.append("idToken", verifiedIdToken);
    formData.append("role", role);
    if (role === "CUSTOM" && customRoleName) {
      formData.append("customRoleName", customRoleName);
    }
    formData.append("permissions", JSON.stringify(selectedPermissions));

    try {
      const res = await addStaffMember(formData);
      if (res?.error) {
        setError(res.error);
      } else {
        toast.success("Staff member onboarded successfully!");
        setName("");
        setRole("RECEPTIONIST");
        setCustomRoleName("");
        setSelectedPermissions(ROLE_PRESETS.RECEPTIONIST);
        setStep(1);
        setPhone("+91 ");
        setOtp("");
        setVerifiedIdToken(null);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to add staff member"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div id="staff-recaptcha"></div>
      {error && (
        <div className="bg-destructive/10 text-destructive text-sm font-medium p-3.5 rounded-xl border border-destructive/20 flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Staff Identity Section */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="staff-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Staff Full Name *
          </Label>
          <Input
            id="staff-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Ramesh Kumar"
            className="rounded-xl"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="staff-phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Phone Number (OTP Verification Required) *
          </Label>
          <div className="flex gap-2">
            <Input
              id="staff-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              readOnly={!!verifiedIdToken || step === 2}
              className={`rounded-xl ${!!verifiedIdToken || step === 2 ? "opacity-60 cursor-not-allowed bg-muted/40" : ""}`}
              required
            />
            {!verifiedIdToken && step === 1 && (
              <Button
                type="button"
                onClick={handleSendOTP}
                disabled={otpLoading || phone.length < 10}
                className="rounded-xl shrink-0"
              >
                {otpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify OTP"}
              </Button>
            )}
          </div>
          {!verifiedIdToken && step === 2 && (
            <div className="flex gap-2 mt-2">
              <Input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-digit OTP"
                maxLength={6}
                className="rounded-xl font-mono text-center tracking-widest"
              />
              <Button
                type="button"
                onClick={handleVerifyOTP}
                disabled={otpLoading || otp.length < 6}
                className="rounded-xl shrink-0"
              >
                {otpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm OTP"}
              </Button>
            </div>
          )}
          {verifiedIdToken && (
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 mt-1">
              <Check className="w-3.5 h-3.5" /> Phone Verified & Bound to Identity
            </div>
          )}
        </div>
      </div>

      {/* Role Template Selector */}
      <div className="space-y-2 pt-2 border-t border-border">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Role Template Preset
        </Label>
        <div className="grid grid-cols-3 gap-2">
          {(["RECEPTIONIST", "MANAGER", "CUSTOM"] as StaffRole[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => handleRoleChange(r)}
              className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all ${
                role === r
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background text-muted-foreground border-border hover:bg-muted/50"
              }`}
            >
              {r === "RECEPTIONIST" ? "Receptionist" : r === "MANAGER" ? "Manager" : "Custom Role"}
            </button>
          ))}
        </div>

        {role === "CUSTOM" && (
          <div className="mt-2 space-y-1">
            <Label htmlFor="custom-title" className="text-xs text-muted-foreground">
              Custom Role Title (optional)
            </Label>
            <Input
              id="custom-title"
              value={customRoleName}
              onChange={(e) => setCustomRoleName(e.target.value)}
              placeholder="e.g. Front Desk Lead, Operations Admin"
              className="rounded-xl text-sm"
            />
          </div>
        )}
      </div>

      {/* Permissions Matrix */}
      <div className="space-y-3 pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Granular Permissions
            </span>
            <span className="ml-2 text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-bold">
              {selectedPermissions.length} Granted
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={selectAllPermissions}
              className="text-primary hover:underline font-semibold"
            >
              Select All
            </button>
            <span className="text-muted-foreground">|</span>
            <button
              type="button"
              onClick={clearAllPermissions}
              className="text-muted-foreground hover:underline font-semibold"
            >
              Clear All
            </button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Authorize exact operations within {libraryName || "this library"}. Changes take effect immediately.
        </p>

        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
          {PERMISSION_GROUPS.map((group) => {
            const groupPermIds = group.permissions.map((p) => p.id);
            const selectedInGroup = groupPermIds.filter((id) =>
              selectedPermissions.includes(id)
            ).length;
            const allSelected = selectedInGroup === groupPermIds.length;
            const isExpanded = !!expandedGroups[group.key];

            return (
              <div
                key={group.key}
                className="border border-border rounded-xl bg-card overflow-hidden shadow-xs"
              >
                <div className="flex items-center justify-between p-3 bg-muted/20 hover:bg-muted/40 transition-colors">
                  <button
                    type="button"
                    onClick={() => toggleGroupExpand(group.key)}
                    className="flex items-center gap-2 text-left flex-1 font-bold text-xs text-foreground cursor-pointer"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    <span>{group.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-background border rounded font-semibold text-muted-foreground">
                      {selectedInGroup}/{groupPermIds.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleGroupAll(group.key)}
                    className="text-[11px] text-muted-foreground hover:text-foreground font-semibold px-2 py-0.5 rounded hover:bg-background transition-colors flex items-center gap-1"
                  >
                    {allSelected ? (
                      <>
                        <CheckSquare className="w-3 h-3 text-primary" />
                        <span>All</span>
                      </>
                    ) : (
                      <>
                        <Square className="w-3 h-3" />
                        <span>Toggle</span>
                      </>
                    )}
                  </button>
                </div>

                {isExpanded && (
                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-border/50 bg-background/50">
                    {group.permissions.map((perm) => {
                      const isChecked = selectedPermissions.includes(perm.id);
                      return (
                        <label
                          key={perm.id}
                          className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                            isChecked
                              ? "bg-primary/5 border-primary/30 text-foreground"
                              : "bg-background border-border/60 text-muted-foreground hover:bg-muted/20"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePermission(perm.id)}
                            className="mt-0.5 rounded text-primary focus:ring-primary/20"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold block truncate text-foreground">
                              {perm.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground block line-clamp-1">
                              {perm.description}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !verifiedIdToken || selectedPermissions.length === 0}
        className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? "Authorizing Staff..." : `Confirm & Add Staff (${selectedPermissions.length} Perms)`}
      </button>
    </form>
  );
}
