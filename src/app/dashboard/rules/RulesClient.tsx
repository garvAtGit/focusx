"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  Zap,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  createRule,
  updateRule,
  deleteRule,
  toggleRule,
} from "@/app/actions/rule-actions";
import type {
  RuleTrigger,
  RuleConditionField,
  RuleOperator,
  RuleAction,
  LibraryRule,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Label maps
// ---------------------------------------------------------------------------

const TRIGGER_LABELS: Record<RuleTrigger, string> = {
  OVERSTAY:         "Student Overstays",
  BOOKING_EXPIRING: "Booking Expiring",
  ABSENT:           "Student Absent",
  PAYMENT_DUE:      "Payment Due",
  CHECKIN:          "Student Checks In",
  CHECKOUT:         "Student Checks Out",
  BOOKING_CREATED:  "Booking Created",
};

const CONDITION_FIELD_LABELS: Record<RuleConditionField, string> = {
  overstay_hours: "Overstay hours",
  days_left:      "Days left in booking",
  absence_days:   "Days absent",
  amount_due:     "Amount due (₹)",
  session_count:  "Check-ins today",
};

const OPERATOR_LABELS: Record<RuleOperator, string> = {
  gt:  "greater than",
  lt:  "less than",
  gte: "at least",
  lte: "at most",
  eq:  "equal to",
};

const ACTION_LABELS: Record<RuleAction, string> = {
  NOTIFY_STUDENT:   "Notify Student",
  NOTIFY_LIBRARIAN: "Notify Me (Librarian)",
  REVOKE_BOOKING:   "Revoke Access",
  ADD_CRM_NOTE:     "Add CRM Note",
  FLAG_FOR_REVIEW:  "Flag for Review",
  MARK_EXPIRED_LEAD:"Mark as Expired Lead",
};

const ACTION_COLORS: Record<RuleAction, string> = {
  NOTIFY_STUDENT:   "bg-blue-100 text-blue-700",
  NOTIFY_LIBRARIAN: "bg-purple-100 text-purple-700",
  REVOKE_BOOKING:   "bg-red-100 text-red-700",
  ADD_CRM_NOTE:     "bg-yellow-100 text-yellow-700",
  FLAG_FOR_REVIEW:  "bg-orange-100 text-orange-700",
  MARK_EXPIRED_LEAD:"bg-gray-100 text-gray-700",
};

// Fields that make sense for each trigger
const TRIGGER_FIELDS: Record<RuleTrigger, RuleConditionField[]> = {
  OVERSTAY:         ["overstay_hours"],
  BOOKING_EXPIRING: ["days_left"],
  ABSENT:           ["absence_days"],
  PAYMENT_DUE:      ["amount_due"],
  CHECKIN:          ["session_count"],
  CHECKOUT:         ["overstay_hours", "session_count"],
  BOOKING_CREATED:  ["session_count"], // "always fire" — set value to 0 with gte
};

const TEMPLATE_VARIABLES = `Available variables: {name} {phone} {library_name} {overstay_hours} {days_left} {absence_days} {amount_due}`;

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface FormState {
  name: string;
  trigger: RuleTrigger;
  conditionField: RuleConditionField;
  conditionOperator: RuleOperator;
  conditionValue: string;
  action: RuleAction;
  actionMessage: string;
}

const DEFAULT_FORM: FormState = {
  name:              "",
  trigger:           "OVERSTAY",
  conditionField:    "overstay_hours",
  conditionOperator: "gt",
  conditionValue:    "1",
  action:            "NOTIFY_STUDENT",
  actionMessage:     "",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  initialRules: LibraryRule[];
}

export function RulesClient({ initialRules }: Props) {
  const [rules, setRules]               = useState<LibraryRule[]>(initialRules);
  const [showForm, setShowForm]         = useState(false);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [form, setForm]                 = useState<FormState>(DEFAULT_FORM);
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [isPending, startTransition]    = useTransition();

  // ---- helpers ----

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Auto-set conditionField when trigger changes
      if (key === "trigger") {
        const fields = TRIGGER_FIELDS[value as RuleTrigger];
        next.conditionField = fields[0];
      }
      return next;
    });
  }

  function openCreate() {
    setForm(DEFAULT_FORM);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(rule: LibraryRule) {
    setForm({
      name:              rule.name,
      trigger:           rule.trigger,
      conditionField:    rule.conditionField,
      conditionOperator: rule.conditionOperator,
      conditionValue:    String(rule.conditionValue),
      action:            rule.action,
      actionMessage:     rule.actionMessage ?? "",
    });
    setEditingId(rule.id);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  // ---- submit ----

  function handleSubmit() {
    const value = parseFloat(form.conditionValue);
    if (!form.name.trim()) { toast.error("Rule name is required"); return; }
    if (isNaN(value) || value < 0) { toast.error("Condition value must be a positive number"); return; }

    const data = {
      name:              form.name.trim(),
      trigger:           form.trigger,
      conditionField:    form.conditionField,
      conditionOperator: form.conditionOperator,
      conditionValue:    value,
      action:            form.action,
      actionMessage:     form.actionMessage.trim() || undefined,
    };

    startTransition(async () => {
      const res = editingId
        ? await updateRule(editingId, data)
        : await createRule(data);

      if (res.error) { toast.error(res.error); return; }

      toast.success(editingId ? "Rule updated" : "Rule created");
      closeForm();

      // Refresh list from server
      const { getRules } = await import("@/app/actions/rule-actions");
      const fresh = await getRules();
      setRules(fresh.rules);
    });
  }

  // ---- toggle ----

  function handleToggle(rule: LibraryRule) {
    startTransition(async () => {
      const res = await toggleRule(rule.id);
      if (res.error) { toast.error(res.error); return; }
      setRules((prev) =>
        prev.map((r) => r.id === rule.id ? { ...r, isActive: !r.isActive } : r)
      );
    });
  }

  // ---- delete ----

  function handleDelete(ruleId: string) {
    if (!confirm("Delete this rule? This cannot be undone.")) return;
    startTransition(async () => {
      const res = await deleteRule(ruleId);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Rule deleted");
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">

      {/* ---- Add Rule button ---- */}
      <div className="flex justify-end">
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-lg text-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> Add Rule
        </button>
      </div>

      {/* ---- Form (create / edit) ---- */}
      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg text-foreground">
              {editingId ? "Edit Rule" : "New Rule"}
            </h2>
            <button onClick={closeForm} className="p-1 hover:bg-muted rounded-full">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Name */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Rule Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="e.g. Overstay Warning"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Trigger */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">When (Trigger)</label>
            <select
              value={form.trigger}
              onChange={(e) => setField("trigger", e.target.value as RuleTrigger)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Condition */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">If (Condition)</label>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={form.conditionField}
                onChange={(e) => setField("conditionField", e.target.value as RuleConditionField)}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {TRIGGER_FIELDS[form.trigger].map((f) => (
                  <option key={f} value={f}>{CONDITION_FIELD_LABELS[f]}</option>
                ))}
              </select>
              <select
                value={form.conditionOperator}
                onChange={(e) => setField("conditionOperator", e.target.value as RuleOperator)}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {Object.entries(OPERATOR_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                step={0.5}
                value={form.conditionValue}
                onChange={(e) => setField("conditionValue", e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Action */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Do (Action)</label>
            <select
              value={form.action}
              onChange={(e) => setField("action", e.target.value as RuleAction)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {Object.entries(ACTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {/* Revoke warning */}
            {form.action === "REVOKE_BOOKING" && (
              <div className="flex items-start gap-2 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  This will <strong>cancel the student's active booking</strong> automatically.
                  Use with caution.
                </span>
              </div>
            )}
          </div>

          {/* Message */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              Message / Note{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              value={form.actionMessage}
              onChange={(e) => setField("actionMessage", e.target.value)}
              rows={3}
              placeholder="Hey {name}, you have overstayed by {overstay_hours} hrs today."
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
            <p className="text-xs text-muted-foreground">{TEMPLATE_VARIABLES}</p>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button
              onClick={closeForm}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-2 rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? "Save Changes" : "Create Rule"}
            </button>
          </div>
        </div>
      )}

      {/* ---- Rules List ---- */}
      {rules.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-12 text-center">
          <Zap className="w-10 h-10 text-muted-foreground opacity-30 mx-auto mb-3" />
          <h3 className="font-bold text-foreground">No automations yet</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Add a rule to automatically take action when something happens in your library.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const isExpanded = expandedId === rule.id;
            return (
              <div
                key={rule.id}
                className={`bg-card border rounded-2xl overflow-hidden transition-all ${
                  rule.isActive ? "border-border" : "border-border/50 opacity-60"
                }`}
              >
                {/* Row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(rule)}
                    disabled={isPending}
                    title={rule.isActive ? "Turn off" : "Turn on"}
                    className="shrink-0"
                  >
                    {rule.isActive ? (
                      <ToggleRight className="w-7 h-7 text-primary" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-muted-foreground" />
                    )}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate">
                      {rule.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {TRIGGER_LABELS[rule.trigger]} &nbsp;·&nbsp;{" "}
                      {CONDITION_FIELD_LABELS[rule.conditionField]}{" "}
                      {OPERATOR_LABELS[rule.conditionOperator]} {rule.conditionValue}
                    </p>
                  </div>

                  {/* Action badge */}
                  <span
                    className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${ACTION_COLORS[rule.action]}`}
                  >
                    {ACTION_LABELS[rule.action]}
                  </span>

                  {/* Expand / actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(rule)}
                      className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      disabled={isPending}
                      className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                    <button
                      onClick={() =>
                        setExpandedId(isExpanded ? null : rule.id)
                      }
                      className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-5 pb-4 pt-0 border-t border-border/50 bg-muted/20">
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-32 shrink-0">Trigger</span>
                        <span className="font-medium">{TRIGGER_LABELS[rule.trigger]}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-32 shrink-0">Condition</span>
                        <span className="font-medium">
                          {CONDITION_FIELD_LABELS[rule.conditionField]}{" "}
                          {OPERATOR_LABELS[rule.conditionOperator]}{" "}
                          {rule.conditionValue}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-32 shrink-0">Action</span>
                        <span className="font-medium">{ACTION_LABELS[rule.action]}</span>
                      </div>
                      {rule.actionMessage && (
                        <div className="flex gap-2">
                          <span className="text-muted-foreground w-32 shrink-0">Message</span>
                          <span className="font-medium italic text-foreground/80">
                            &ldquo;{rule.actionMessage}&rdquo;
                          </span>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-32 shrink-0">Cooldown</span>
                        <span className="font-medium">Once per student per day</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
