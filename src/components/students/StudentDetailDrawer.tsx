"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  User,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  Grid,
  Shield,
  Clock,
  Tag,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
} from "lucide-react";
import { format } from "date-fns";

export interface StudentDrawerData {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  rfidTag?: string | null;
  seatNumber?: string | number | null;
  planName?: string | null;
  status?: string | null;
  startTime?: Date | string | null;
  endTime?: Date | string | null;
  isPaused?: boolean;
  notes?: string | null;
}

interface StudentDetailDrawerProps {
  student: StudentDrawerData | null;
  isOpen: boolean;
  onClose: () => void;
  onAction?: (action: string, student: StudentDrawerData) => void;
}

export function StudentDetailDrawer({
  student,
  isOpen,
  onClose,
  onAction,
}: StudentDetailDrawerProps) {
  if (!student) return null;

  const startFormatted = student.startTime
    ? format(new Date(student.startTime), "PP")
    : "Not specified";
  const endFormatted = student.endTime
    ? format(new Date(student.endTime), "PP")
    : "Not specified";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 transition-opacity"
          />

          {/* Native-feeling slide-over drawer */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 32 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[460px] bg-card border-l border-border z-50 shadow-2xl flex flex-col focus:outline-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-border flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                  {student.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground font-heading">
                    {student.name}
                  </h2>
                  <p className="text-xs text-muted-foreground">Student Profile & Membership</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable details */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 focusx-sidebar-scroll">
              {/* Membership Status Card */}
              <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Membership Status
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      student.isPaused
                        ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                    }`}
                  >
                    {student.isPaused ? (
                      <>
                        <PauseCircle className="w-3.5 h-3.5" /> Paused
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Active
                      </>
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Plan</span>
                    <span className="text-sm font-semibold text-foreground">
                      {student.planName || "Standard Plan"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Assigned Seat</span>
                    <span className="text-sm font-semibold text-foreground flex items-center gap-1">
                      <Grid className="w-3.5 h-3.5 text-muted-foreground" />
                      {student.seatNumber ? `Seat #${student.seatNumber}` : "Flexible / None"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60 text-xs text-muted-foreground">
                  <div>
                    <span className="block text-[11px]">Valid From</span>
                    <span className="font-mono text-foreground/80">{startFormatted}</span>
                  </div>
                  <div>
                    <span className="block text-[11px]">Valid Until</span>
                    <span className="font-mono text-foreground/80">{endFormatted}</span>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Contact Information
                </h3>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border/70 bg-card text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="font-mono text-foreground">{student.phone || "No phone added"}</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border/70 bg-card text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-foreground truncate">{student.email || "No email added"}</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border/70 bg-card text-sm">
                    <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="font-mono text-foreground">
                      RFID: {student.rfidTag || "Not paired yet"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {student.notes && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Staff CRM Notes
                  </h3>
                  <div className="p-3 rounded-lg border border-border bg-muted/20 text-xs text-foreground/80">
                    {student.notes}
                  </div>
                </div>
              )}
            </div>

            {/* Footer quick action buttons */}
            <div className="p-4 border-t border-border bg-muted/20 flex gap-2">
              <button
                onClick={() => onAction?.("PAUSE_RESUME", student)}
                className="flex-1 py-2 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-all cursor-pointer shadow-2xs"
              >
                {student.isPaused ? "Resume Membership" : "Pause Membership"}
              </button>
              <button
                onClick={() => onAction?.("CHANGE_SEAT", student)}
                className="flex-1 py-2 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-all cursor-pointer shadow-2xs"
              >
                Change Seat
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
