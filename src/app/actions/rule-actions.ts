'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getSession } from './auth-actions'
import { getActiveLibrary } from '@/lib/dashboard-utils'
import type {
  RuleTrigger,
  RuleConditionField,
  RuleOperator,
  RuleAction,
} from '@prisma/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RuleFormData {
  name: string
  trigger: RuleTrigger
  conditionField: RuleConditionField
  conditionOperator: RuleOperator
  conditionValue: number
  action: RuleAction
  actionMessage?: string
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function requireLibrarianSession() {
  const session = await getSession()
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) {
    throw new Error('Unauthorized')
  }
  const library = await getActiveLibrary(session)
  if (!library) throw new Error('No library found')
  return { session, library }
}

// ---------------------------------------------------------------------------
// READ
// ---------------------------------------------------------------------------

export async function getRules() {
  const { library } = await requireLibrarianSession()

  const rules = await prisma.libraryRule.findMany({
    where: { libraryId: library.id },
    orderBy: { createdAt: 'asc' },
  })

  return { rules }
}

export async function getRuleExecutions(studentId: string) {
  const { library } = await requireLibrarianSession()

  const executions = await prisma.ruleExecution.findMany({
    where: {
      libraryId: library.id,
      studentId,
      status: 'SUCCESS',
    },
    include: {
      rule: { select: { name: true, action: true } },
    },
    orderBy: { executedAt: 'desc' },
    take: 20,
  })

  return { executions }
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

export async function createRule(data: RuleFormData) {
  const { library } = await requireLibrarianSession()

  // Validate conditionValue is a real number
  if (!Number.isFinite(data.conditionValue) || data.conditionValue < 0) {
    return { error: 'Condition value must be a positive number' }
  }

  if (!data.name?.trim()) {
    return { error: 'Rule name is required' }
  }

  await prisma.libraryRule.create({
    data: {
      libraryId:         library.id,
      name:              data.name.trim(),
      isActive:          true,
      trigger:           data.trigger,
      conditionField:    data.conditionField,
      conditionOperator: data.conditionOperator,
      conditionValue:    data.conditionValue,
      action:            data.action,
      actionMessage:     data.actionMessage?.trim() || null,
    },
  })

  revalidatePath('/dashboard/rules')
  return { success: true }
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

export async function updateRule(ruleId: string, data: Partial<RuleFormData>) {
  const { library } = await requireLibrarianSession()

  const rule = await prisma.libraryRule.findUnique({ where: { id: ruleId } })
  if (!rule || rule.libraryId !== library.id) {
    return { error: 'Rule not found' }
  }

  await prisma.libraryRule.update({
    where: { id: ruleId },
    data: {
      ...(data.name              !== undefined && { name: data.name.trim() }),
      ...(data.trigger           !== undefined && { trigger: data.trigger }),
      ...(data.conditionField    !== undefined && { conditionField: data.conditionField }),
      ...(data.conditionOperator !== undefined && { conditionOperator: data.conditionOperator }),
      ...(data.conditionValue    !== undefined && { conditionValue: data.conditionValue }),
      ...(data.action            !== undefined && { action: data.action }),
      ...(data.actionMessage     !== undefined && { actionMessage: data.actionMessage?.trim() || null }),
    },
  })

  revalidatePath('/dashboard/rules')
  return { success: true }
}

// ---------------------------------------------------------------------------
// TOGGLE active/inactive
// ---------------------------------------------------------------------------

export async function toggleRule(ruleId: string) {
  const { library } = await requireLibrarianSession()

  const rule = await prisma.libraryRule.findUnique({ where: { id: ruleId } })
  if (!rule || rule.libraryId !== library.id) {
    return { error: 'Rule not found' }
  }

  await prisma.libraryRule.update({
    where: { id: ruleId },
    data: { isActive: !rule.isActive },
  })

  revalidatePath('/dashboard/rules')
  return { success: true, isActive: !rule.isActive }
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

export async function deleteRule(ruleId: string) {
  const { library } = await requireLibrarianSession()

  const rule = await prisma.libraryRule.findUnique({ where: { id: ruleId } })
  if (!rule || rule.libraryId !== library.id) {
    return { error: 'Rule not found' }
  }

  // Cascade deletes RuleExecution rows automatically (onDelete: Cascade)
  await prisma.libraryRule.delete({ where: { id: ruleId } })

  revalidatePath('/dashboard/rules')
  return { success: true }
}

// ---------------------------------------------------------------------------
// MANUAL NOTIFY (Feature 2)
// ---------------------------------------------------------------------------

export async function manualNotifyStudent(
  studentId: string,
  title: string,
  message: string,
) {
  const { library } = await requireLibrarianSession()

  if (!title?.trim()) return { error: 'Title is required' }
  if (!message?.trim()) return { error: 'Message is required' }

  // Scope check: student must have a booking at this library
  const hasBooking = await prisma.booking.findFirst({
    where: { studentId, libraryId: library.id },
    select: { id: true },
  })
  if (!hasBooking) return { error: 'Student not found in this library' }

  // Replace {name} etc in the message
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { name: true, phone: true },
  })

  const rendered = message
    .replace(/\{name\}/g, student?.name ?? '')
    .replace(/\{phone\}/g, student?.phone ?? '')
    .replace(/\{library_name\}/g, library.name)

  await prisma.notification.create({
    data: {
      studentId,
      title: title.trim(),
      message: rendered,
      type: 'WARNING',
    },
  })

  return { success: true }
}
