"use client";

import { useEffect, useState } from "react";
import { Zap, Loader2 } from "lucide-react";
import { getRuleExecutions } from "@/app/actions/rule-actions";
import { formatDistanceToNow } from "date-fns";

type Execution = {
  id: string;
  action: string;
  executedAt: Date;
  rule: { name: string; action: string } | null;
};

const ACTION_LABELS: Record<string, string> = {
  NOTIFY_STUDENT:    "Notified Student",
  NOTIFY_LIBRARIAN:  "Notified Librarian",
  REVOKE_BOOKING:    "Revoked Access",
  ADD_CRM_NOTE:      "Added CRM Note",
  FLAG_FOR_REVIEW:   "Flagged for Review",
  MARK_EXPIRED_LEAD: "Marked Expired Lead",
};

const ACTION_COLORS: Record<string, string> = {
  NOTIFY_STUDENT:    "text-blue-600",
  NOTIFY_LIBRARIAN:  "text-purple-600",
  REVOKE_BOOKING:    "text-red-600",
  ADD_CRM_NOTE:      "text-yellow-600",
  FLAG_FOR_REVIEW:   "text-orange-600",
  MARK_EXPIRED_LEAD: "text-gray-500",
};

interface Props {
  studentId: string;
}

export function AutoActionsLog({ studentId }: Props) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    getRuleExecutions(studentId).then((res) => {
      setExecutions(res.executions as Execution[]);
      setLoading(false);
    });
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="w-3 h-3 animate-spin" />
        Loading auto actions...
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-1">
        No automated actions yet.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {executions.map((ex) => (
        <div key={ex.id} className="flex items-center gap-2 text-xs">
          <Zap
            className={`w-3 h-3 shrink-0 ${ACTION_COLORS[ex.action] ?? "text-muted-foreground"}`}
          />
          <span className={`font-medium ${ACTION_COLORS[ex.action] ?? "text-foreground"}`}>
            {ex.rule?.name ?? ACTION_LABELS[ex.action] ?? ex.action}
          </span>
          <span className="text-muted-foreground">
            —{" "}
            {formatDistanceToNow(new Date(ex.executedAt), { addSuffix: true })}
          </span>
        </div>
      ))}
    </div>
  );
}
