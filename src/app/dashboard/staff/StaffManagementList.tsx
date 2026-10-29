'use client'

import { useState } from "react";
import {
  Shield,
  Trash2,
  Edit2,
  Eye,
  PauseCircle,
  PlayCircle,
  History,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Lock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateStaffPermissions,
  updateStaffStatus,
  removeStaffMember,
  getStaffAuditHistory,
  type StaffAuditEntry,
} from "@/app/actions/staff-actions";
import {
  PERMISSION_GROUPS,
  ROLE_PRESETS,
  ALL_PERMISSIONS,
} from "@/lib/permissions-registry";
import type { StaffRole, StaffStatus } from "@prisma/client";

export type StaffItem = {
  id: string; // LibraryStaff.id or synthetic id for legacy
  userId: string;
  name: string;
  phone: string | null;
  role: StaffRole;
  customRoleName?: string | null;
  status: StaffStatus;
  permissions: string[];
  updatedAt: string;
  libraryName: string;
  isLegacy?: boolean;
};

interface StaffManagementListProps {
  staffList: StaffItem[];
  canManage: boolean;
  currentUserId: string;
  libraryId: string;
}

function maskPhone(phone: string | null): string {
  if (!phone) return "No phone";
  const cleaned = phone.trim();
  if (cleaned.length <= 6) return cleaned;
  const start = cleaned.slice(0, 5);
  const end = cleaned.slice(-3);
  return `${start}****${end}`;
}

export function StaffManagementList({
  staffList,
  canManage,
  currentUserId,
  libraryId,
}: StaffManagementListProps) {
  // Modal states
  const [viewingStaff, setViewingStaff] = useState<StaffItem | null>(null);
  const [editingStaff, setEditingStaff] = useState<StaffItem | null>(null);
  const [editRole, setEditRole] = useState<StaffRole>("RECEPTIONIST");
  const [editCustomName, setEditCustomName] = useState("");
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [editingLoading, setEditingLoading] = useState(false);

  // Status/Revoke dialogs
  const [statusConfirmStaff, setStatusConfirmStaff] = useState<{
    staff: StaffItem;
    targetStatus: "ACTIVE" | "SUSPENDED";
  } | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const [revokingStaff, setRevokingStaff] = useState<StaffItem | null>(null);
  const [revokeLoading, setRevokeLoading] = useState(false);

  // Audit History modal
  const [auditStaff, setAuditStaff] = useState<StaffItem | null>(null);
  const [auditLogs, setAuditLogs] = useState<StaffAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Open Edit Modal
  const handleOpenEdit = (staff: StaffItem) => {
    setEditingStaff(staff);
    setEditRole(staff.role);
    setEditCustomName(staff.customRoleName || "");
    setEditPermissions(staff.permissions);
  };

  const handleEditRoleChange = (newRole: StaffRole) => {
    setEditRole(newRole);
    if (newRole === "RECEPTIONIST") {
      setEditPermissions(ROLE_PRESETS.RECEPTIONIST);
    } else if (newRole === "MANAGER") {
      setEditPermissions(ROLE_PRESETS.MANAGER);
    }
  };

  const toggleEditPermission = (permId: string) => {
    setEditPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const handleSavePermissions = async () => {
    if (!editingStaff) return;
    setEditingLoading(true);
    try {
      const res = await updateStaffPermissions({
        staffMembershipId: editingStaff.id,
        role: editRole,
        customRoleName: editRole === "CUSTOM" ? editCustomName : undefined,
        permissions: editPermissions,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Staff permissions updated!");
        setEditingStaff(null);
      }
    } catch {
      toast.error("Failed to update staff permissions");
    } finally {
      setEditingLoading(false);
    }
  };

  // Toggle status (Active / Suspended)
  const handleConfirmStatusChange = async () => {
    if (!statusConfirmStaff) return;
    setStatusLoading(true);
    try {
      const res = await updateStaffStatus({
        staffMembershipId: statusConfirmStaff.staff.id,
        status: statusConfirmStaff.targetStatus,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(
          `Staff access ${statusConfirmStaff.targetStatus === "SUSPENDED" ? "suspended" : "reactivated"}!`
        );
        setStatusConfirmStaff(null);
      }
    } catch {
      toast.error("Failed to update status");
    } finally {
      setStatusLoading(false);
    }
  };

  // Revoke staff
  const handleConfirmRevoke = async () => {
    if (!revokingStaff) return;
    setRevokeLoading(true);
    try {
      const res = await removeStaffMember(revokingStaff.id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Staff member access revoked");
        setRevokingStaff(null);
      }
    } catch {
      toast.error("Failed to revoke staff member");
    } finally {
      setRevokeLoading(false);
    }
  };

  // Fetch Audit History
  const handleOpenAudit = async (staff: StaffItem) => {
    setAuditStaff(staff);
    setAuditLoading(true);
    try {
      const res = await getStaffAuditHistory(staff.id);
      if (res.success) {
        setAuditLogs(res.logs);
      } else {
        toast.error(res.error || "Failed to load audit history");
        setAuditLogs([]);
      }
    } catch {
      toast.error("Failed to load audit history");
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  };

  return (
    <div className="flex-1 space-y-4">
      {staffList.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-16 border-2 border-dashed rounded-2xl bg-muted/10">
          <Shield className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="font-semibold text-foreground">No staff members onboarded yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add receptionists or managers using the form to authorize dashboard access.
          </p>
        </div>
      ) : (
        staffList.map((staff) => {
          const isCurrentUser = staff.userId === currentUserId;
          const isSuspended = staff.status === "SUSPENDED";
          const isRevoked = staff.status === "REVOKED";

          return (
            <div
              key={staff.id}
              className={`p-5 border rounded-2xl bg-card shadow-xs transition-all ${
                isSuspended ? "opacity-75 bg-muted/30 border-amber-500/30" : "hover:shadow-md"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Left: Info */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base text-foreground">{staff.name}</h3>
                    {isCurrentUser && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-muted text-muted-foreground rounded">
                        You
                      </span>
                    )}

                    {/* Role Badge */}
                    <span
                      className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full ${
                        staff.role === "MANAGER"
                          ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20"
                          : staff.role === "CUSTOM"
                          ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20"
                          : "bg-primary/10 text-primary border border-primary/20"
                      }`}
                    >
                      {staff.customRoleName || staff.role}
                    </span>

                    {/* Status Badge */}
                    <span
                      className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                        staff.status === "ACTIVE"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : staff.status === "SUSPENDED"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 font-black"
                          : staff.status === "INVITED"
                          ? "bg-sky-500/10 text-sky-600"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {staff.status}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground font-mono">
                    {maskPhone(staff.phone)} &bull; {staff.libraryName}
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setViewingStaff(staff)}
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>{staff.permissions.length} Permissions</span>
                    </button>
                    <span className="text-muted-foreground text-xs">&bull;</span>
                    <button
                      type="button"
                      onClick={() => handleOpenAudit(staff)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                    >
                      <History className="w-3 h-3" />
                      <span>Audit Trail</span>
                    </button>
                  </div>
                </div>

                {/* Right: Actions */}
                {canManage && (
                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    {/* Edit Permissions Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(staff)}
                      disabled={isCurrentUser || isRevoked}
                      title={isCurrentUser ? "You cannot edit your own permissions" : "Edit Role & Permissions"}
                      className="h-8 text-xs font-semibold rounded-lg gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>

                    {/* Suspend / Reactivate Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isCurrentUser || isRevoked}
                      onClick={() =>
                        setStatusConfirmStaff({
                          staff,
                          targetStatus: isSuspended ? "ACTIVE" : "SUSPENDED",
                        })
                      }
                      title={isSuspended ? "Reactivate Staff" : "Suspend Staff Access"}
                      className={`h-8 w-8 p-0 rounded-lg ${
                        isSuspended
                          ? "text-emerald-600 hover:bg-emerald-500/10"
                          : "text-amber-600 hover:bg-amber-500/10"
                      }`}
                    >
                      {isSuspended ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
                    </Button>

                    {/* Revoke Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isCurrentUser}
                      onClick={() => setRevokingStaff(staff)}
                      title="Revoke Staff Access"
                      className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* MODAL 1: VIEW PERMISSIONS DETAILS */}
      <Dialog open={!!viewingStaff} onOpenChange={(open) => !open && setViewingStaff(null)}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Shield className="w-5 h-5 text-primary" />
              <span>{viewingStaff?.name} &mdash; Permissions</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Role: <strong>{viewingStaff?.customRoleName || viewingStaff?.role}</strong> &bull; Total:{" "}
              {viewingStaff?.permissions.length} granted
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
            {PERMISSION_GROUPS.map((group) => {
              const grantedInGroup = group.permissions.filter((p) =>
                viewingStaff?.permissions.includes(p.id)
              );
              if (grantedInGroup.length === 0) return null;

              return (
                <div key={group.key} className="border border-border rounded-xl p-3 bg-muted/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-foreground">{group.label}</span>
                    <span className="text-[10px] px-2 py-0.5 bg-background border rounded font-semibold text-muted-foreground">
                      {grantedInGroup.length}/{group.permissions.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {grantedInGroup.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-1.5 text-xs bg-background p-1.5 rounded-lg border border-border/50"
                      >
                        <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span className="truncate">{p.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setViewingStaff(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: EDIT ROLE & PERMISSIONS */}
      <Dialog open={!!editingStaff} onOpenChange={(open) => !open && setEditingStaff(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Edit2 className="w-5 h-5 text-primary" />
              <span>Edit Staff Access: {editingStaff?.name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update role template or modify exact permissions for this staff member.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            {/* Role Preset Tabs */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Role Preset</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["RECEPTIONIST", "MANAGER", "CUSTOM"] as StaffRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleEditRoleChange(r)}
                    className={`py-1.5 px-2 text-xs font-bold rounded-lg border text-center transition-all ${
                      editRole === r
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                    }`}
                  >
                    {r === "RECEPTIONIST" ? "Receptionist" : r === "MANAGER" ? "Manager" : "Custom"}
                  </button>
                ))}
              </div>
            </div>

            {editRole === "CUSTOM" && (
              <div className="space-y-1">
                <Label htmlFor="edit-custom-title" className="text-xs text-muted-foreground">
                  Custom Role Title
                </Label>
                <Input
                  id="edit-custom-title"
                  value={editCustomName}
                  onChange={(e) => setEditCustomName(e.target.value)}
                  placeholder="e.g. Weekend Supervisor"
                  className="rounded-lg text-xs"
                />
              </div>
            )}

            {/* Permissions Matrix */}
            <div className="space-y-2 border-t pt-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span>Effective Permissions ({editPermissions.length})</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditPermissions(ALL_PERMISSIONS)}
                    className="text-primary hover:underline text-[11px]"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditPermissions([])}
                    className="text-muted-foreground hover:underline text-[11px]"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {PERMISSION_GROUPS.map((group) => {
                  const groupPermIds = group.permissions.map((p) => p.id);
                  const selectedCount = groupPermIds.filter((id) =>
                    editPermissions.includes(id)
                  ).length;

                  return (
                    <div key={group.key} className="border rounded-lg p-2.5 bg-muted/20 text-xs">
                      <div className="flex items-center justify-between mb-1.5 font-bold">
                        <span>{group.label}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {selectedCount}/{groupPermIds.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {group.permissions.map((perm) => {
                          const isChecked = editPermissions.includes(perm.id);
                          return (
                            <label
                              key={perm.id}
                              className={`flex items-center gap-2 p-1.5 rounded border text-[11px] cursor-pointer transition-colors ${
                                isChecked
                                  ? "bg-primary/5 border-primary/30 text-foreground font-semibold"
                                  : "bg-background border-border/50 text-muted-foreground"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleEditPermission(perm.id)}
                                className="rounded text-primary"
                              />
                              <span className="truncate">{perm.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setEditingStaff(null)} disabled={editingLoading}>
              Cancel
            </Button>
            <Button onClick={handleSavePermissions} disabled={editingLoading}>
              {editingLoading && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: STATUS CHANGE CONFIRMATION */}
      <Dialog open={!!statusConfirmStaff} onOpenChange={(open) => !open && setStatusConfirmStaff(null)}>
        <DialogContent className="max-w-sm p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span>
                {statusConfirmStaff?.targetStatus === "SUSPENDED" ? "Suspend Staff Access" : "Reactivate Staff"}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              {statusConfirmStaff?.targetStatus === "SUSPENDED" ? (
                <>
                  Are you sure you want to suspend access for{" "}
                  <strong>{statusConfirmStaff?.staff.name}</strong>? They will be immediately blocked
                  from accessing all dashboard features until reactivated.
                </>
              ) : (
                <>
                  Reactivate staff access for <strong>{statusConfirmStaff?.staff.name}</strong>? Their
                  previously assigned permissions will be restored immediately.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3">
            <Button variant="outline" onClick={() => setStatusConfirmStaff(null)} disabled={statusLoading}>
              Cancel
            </Button>
            <Button
              variant={statusConfirmStaff?.targetStatus === "SUSPENDED" ? "destructive" : "default"}
              onClick={handleConfirmStatusChange}
              disabled={statusLoading}
            >
              {statusLoading && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              {statusConfirmStaff?.targetStatus === "SUSPENDED" ? "Confirm Suspend" : "Reactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: REVOKE CONFIRMATION */}
      <Dialog open={!!revokingStaff} onOpenChange={(open) => !open && setRevokingStaff(null)}>
        <DialogContent className="max-w-sm p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-destructive">
              <Trash2 className="w-5 h-5" />
              <span>Revoke Staff Access</span>
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              Are you sure you want to completely revoke dashboard access for{" "}
              <strong>{revokingStaff?.name}</strong>? This will revoke all their permissions and
              remove them from the active staff roster.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3">
            <Button variant="outline" onClick={() => setRevokingStaff(null)} disabled={revokeLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmRevoke} disabled={revokeLoading}>
              {revokeLoading && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              Revoke Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 5: AUDIT LOG HISTORY */}
      <Dialog open={!!auditStaff} onOpenChange={(open) => !open && setAuditStaff(null)}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <History className="w-5 h-5 text-primary" />
              <span>Audit History &mdash; {auditStaff?.name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Complete history of access grants, modifications, and status changes.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
            {auditLoading ? (
              <div className="py-12 text-center text-muted-foreground flex flex-col items-center">
                <Loader2 className="w-6 h-6 animate-spin mb-2" />
                <span className="text-xs">Loading audit trail...</span>
              </div>
            ) : auditLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No audit entries found.</p>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="p-3 border rounded-xl bg-muted/20 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">{log.action}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    By: <span className="font-semibold text-foreground">{log.actorName}</span>
                  </p>
                  {log.reason && <p className="text-[11px] italic text-muted-foreground">{log.reason}</p>}
                  {log.newPerms && (
                    <p className="text-[10px] text-muted-foreground font-mono">
                      Perms Count: {log.newPerms.length}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setAuditStaff(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
