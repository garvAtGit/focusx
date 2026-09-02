/**
 * Rule Engine — evaluates LibraryRules and executes their actions.
 *
 * Usage:
 *   await fireRules({ trigger: 'OVERSTAY', libraryId, studentId, context: { overstay_hours: 2.5 } })
 *
 * Design principles:
 * - Pure evaluation: condition check is a plain function, no DB calls.
 * - Cooldown: a rule fires at most once per student per calendar day (IST).
 * - Destructive actions (REVOKE_BOOKING) run last.
 * - All executions are logged to RuleExecution regardless of outcome.
 */

import prisma from '@/lib/prisma'
import type {
  RuleTrigger,
  RuleConditionField,
  RuleOperator,
  RuleAction,
} from '@prisma/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RuleContext {
  /** Hours the student overstayed their daily plan limit (OVERSTAY trigger) */
  overstay_hours?: number
  /** Calendar days left until booking expires (BOOKING_EXPIRING trigger) */
  days_left?: number
  /** Consecutive days the student has not visited (ABSENT trigger) */
  absence_days?: number
  /** Outstanding dues in rupees (PAYMENT_DUE trigger) */
  amount_due?: number
  /** Number of check-ins today (CHECKIN trigger) */
  session_count?: number
}

export interface FireRulesInput {
  trigger: RuleTrigger
  libraryId: string
  studentId: string
  context: RuleContext
}

// ---------------------------------------------------------------------------
// Condition evaluator (pure, no I/O)
// ---------------------------------------------------------------------------

function evaluateCondition(
  field: RuleConditionField,
  operator: RuleOperator,
  threshold: number,
  ctx: RuleContext,
): boolean {
  const raw = ctx[field as keyof RuleContext]
  if (raw === undefined || raw === null) return false
  const value = Number(raw)
  if (!Number.isFinite(value)) return false

  switch (operator) {
    case 'gt':  return value > threshold
    case 'lt':  return value < threshold
    case 'gte': return value >= threshold
    case 'lte': return value <= threshold
    case 'eq':  return value === threshold
    default:    return false
  }
}

// ---------------------------------------------------------------------------
// Template renderer
// ---------------------------------------------------------------------------

function renderMessage(
  template: string | null | undefined,
  vars: Record<string, string | number>,
): string {
  if (!template) return ''
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const val = vars[key]
    return val !== undefined ? String(val) : `{${key}}`
  })
}

// ---------------------------------------------------------------------------
// Cooldown check — one execution per rule per student per IST day
// ---------------------------------------------------------------------------

async function hasRecentExecution(
  ruleId: string,
  studentId: string,
): Promise<boolean> {
  // Start of today in IST (UTC+5:30)
  const nowUtc = new Date()
  const istOffsetMs = 5.5 * 60 * 60 * 1000
  const nowIst = new Date(nowUtc.getTime() + istOffsetMs)
  const startOfDayIst = new Date(
    Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate())
  )
  const startOfDayUtc = new Date(startOfDayIst.getTime() - istOffsetMs)

  const existing = await prisma.ruleExecution.findFirst({
    where: {
      ruleId,
      studentId,
      executedAt: { gte: startOfDayUtc },
      status: 'SUCCESS',
    },
    select: { id: true },
  })
  return !!existing
}

// ---------------------------------------------------------------------------
// Action executor
// ---------------------------------------------------------------------------

async function executeAction(
  action: RuleAction,
  rule: { id: string; name: string; actionMessage: string | null },
  studentId: string,
  libraryId: string,
  ctx: RuleContext,
): Promise<void> {
  // Build template variables
  const templateVars: Record<string, string | number> = {
    overstay_hours: ctx.overstay_hours !== undefined ? Math.round(ctx.overstay_hours * 10) / 10 : 0,
    days_left:      ctx.days_left      ?? 0,
    absence_days:   ctx.absence_days   ?? 0,
    amount_due:     ctx.amount_due     ?? 0,
    session_count:  ctx.session_count  ?? 0,
  }

  // Fetch student name/phone for template vars and notification targeting
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, phone: true },
  })
  if (student) {
    templateVars.name  = student.name
    templateVars.phone = student.phone ?? ''
  }

  // Fetch library name
  const library = await prisma.library.findUnique({
    where: { id: libraryId },
    select: { name: true, librarianId: true },
  })
  if (library) {
    templateVars.library_name = library.name
  }

  const message = renderMessage(rule.actionMessage, templateVars)

  switch (action) {
    case 'NOTIFY_STUDENT': {
      await prisma.notification.create({
        data: {
          studentId,
          title: rule.name,
          message: message || `Automated alert from ${templateVars.library_name || 'your library'}.`,
          type: 'WARNING',
        },
      })
      break
    }

    case 'NOTIFY_LIBRARIAN': {
      if (!library) break
      // Find the librarian user and send them a notification
      await prisma.notification.create({
        data: {
          studentId: library.librarianId, // notification goes to librarian
          title: rule.name,
          message: message || `Rule triggered for student ${templateVars.name}.`,
          type: 'WARNING',
        },
      })
      break
    }

    case 'REVOKE_BOOKING': {
      // Use existing revokeConfirmedBookings logic — cancel the active booking
      const activeBooking = await prisma.booking.findFirst({
        where: {
          studentId,
          libraryId,
          status: 'CONFIRMED',
          endTime: { gt: new Date() },
        },
        select: { id: true },
      })
      if (activeBooking) {
        await prisma.booking.update({
          where: { id: activeBooking.id },
          data: {
            status: 'CANCELLED',
            revokedReason: message || `Auto-revoked by rule: ${rule.name}`,
          },
        })
        // Also notify the student about the revocation
        await prisma.notification.create({
          data: {
            studentId,
            title: 'Booking Revoked',
            message: message || `Your booking has been revoked by the library.`,
            type: 'WARNING',
          },
        })
      }
      break
    }

    case 'ADD_CRM_NOTE': {
      const noteText = message || `[Auto] Rule "${rule.name}" triggered.`
      // Append to existing note rather than overwrite
      const existing = await prisma.user.findUnique({
        where: { id: studentId },
        select: { crmNote: true },
      })
      const timestamp = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
      const newNote = existing?.crmNote
        ? `${existing.crmNote}\n[${timestamp}] ${noteText}`
        : `[${timestamp}] ${noteText}`

      await prisma.user.update({
        where: { id: studentId },
        data: { crmNote: newNote },
      })
      break
    }

    case 'FLAG_FOR_REVIEW': {
      // Add a CRM note with a FLAG prefix — visible in dashboard
      const existing = await prisma.user.findUnique({
        where: { id: studentId },
        select: { crmNote: true },
      })
      const timestamp = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
      const flagNote = `[${timestamp}] 🚩 FLAGGED: ${message || rule.name}`
      const newNote = existing?.crmNote
        ? `${existing.crmNote}\n${flagNote}`
        : flagNote

      await prisma.user.update({
        where: { id: studentId },
        data: { crmNote: newNote },
      })
      break
    }

    case 'MARK_EXPIRED_LEAD': {
      await prisma.user.update({
        where: { id: studentId },
        data: { isExpiredLead: true },
      })
      break
    }

    default:
      throw new Error(`Unknown action: ${action}`)
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Load all active rules for the given trigger + library, evaluate conditions,
 * apply cooldowns, and execute passing actions.
 *
 * Returns the number of rules that actually executed.
 */
export async function fireRules(input: FireRulesInput): Promise<number> {
  const { trigger, libraryId, studentId, context } = input

  // Load active rules for this trigger
  const rules = await prisma.libraryRule.findMany({
    where: { libraryId, isActive: true, trigger },
    orderBy: { createdAt: 'asc' },
  })

  if (rules.length === 0) return 0

  // Separate destructive from non-destructive so they run last
  const nonDestructive = rules.filter(r => r.action !== 'REVOKE_BOOKING')
  const destructive    = rules.filter(r => r.action === 'REVOKE_BOOKING')
  const ordered        = [...nonDestructive, ...destructive]

  let executed = 0

  for (const rule of ordered) {
    // 1. Evaluate condition
    const passes = evaluateCondition(
      rule.conditionField,
      rule.conditionOperator,
      rule.conditionValue,
      context,
    )
    if (!passes) continue

    // 2. Cooldown check
    const alreadyRan = await hasRecentExecution(rule.id, studentId)
    if (alreadyRan) continue

    // 3. Execute action + log result
    try {
      await executeAction(rule.action, rule, studentId, libraryId, context)

      await prisma.ruleExecution.create({
        data: {
          ruleId:    rule.id,
          libraryId,
          studentId,
          trigger,
          action:    rule.action,
          status:    'SUCCESS',
        },
      })
      executed++
    } catch (err) {
      console.error(`[RuleEngine] Failed to execute rule ${rule.id}:`, err)
      await prisma.ruleExecution.create({
        data: {
          ruleId:       rule.id,
          libraryId,
          studentId,
          trigger,
          action:       rule.action,
          status:       'FAILED',
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      })
    }
  }

  return executed
}
