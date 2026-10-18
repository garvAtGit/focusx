'use server'

import prisma from "@/lib/prisma"
import { revalidatePath, updateTag } from "next/cache"
import { PlanType } from "@prisma/client"
import { getSession } from "./auth-actions"
import { invalidateLibraryRuntimeCache } from "@/lib/library-cache"
import {
  parseMoney,
  parseDiscount,
  parsePositiveInt,
  parseOptionalInt,
  requireString,
} from "@/lib/validation"

const VALID_PLAN_TYPES = new Set<PlanType>(['FIXED', 'FLEXIBLE']);

function isPlanType(value: unknown): value is PlanType {
  return typeof value === 'string' && VALID_PLAN_TYPES.has(value as PlanType);
}

function parsePlanType(value: unknown): PlanType {
  if (!isPlanType(value)) {
    throw new Error("Invalid plan type");
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const MAX_BATCH_PLANS = 100;

export async function addPlan(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

  const library = await prisma.library.findFirst({ where: session.role === 'ADMIN' ? {} : { librarianId: session.userId } });
  if (!library) throw new Error("No library found to attach the plan to.");

  const name = requireString(formData.get("name"), "Plan name", 120);
  const type = parsePlanType(formData.get("type"));
  const validityDays = parsePositiveInt(formData.get("validityDays"), "Validity days", 1, 3650);
  const price = parseMoney(formData.get("price"), "Price");
  const discount = parseDiscount(formData.get("discount"));
  const durationHours = parseOptionalInt(formData.get("durationHours"), "Duration hours", 1, 24);

  await prisma.plan.create({
    data: { name, type, validityDays, durationHours, price, discount, libraryId: library.id }
  });

  await invalidateLibraryRuntimeCache(library.id);
  updateTag(`library:${library.id}`);
  updateTag('libraries:featured');
  revalidatePath(`/library/${library.id}`);
  revalidatePath("/dashboard/plans");
}

export async function batchAddPlans(plansData: string): Promise<void> {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

  const library = await prisma.library.findFirst({ where: session.role === 'ADMIN' ? {} : { librarianId: session.userId } });
  if (!library) throw new Error("No library found to attach the plan to.");

  let parsedPlans: unknown;
  try {
    parsedPlans = JSON.parse(plansData) as unknown;
  } catch {
    throw new Error("Invalid plans payload");
  }
  if (!Array.isArray(parsedPlans)) throw new Error("Invalid plans payload");
  const plans: unknown[] = parsedPlans;
  if (plans.length === 0) return;
  if (plans.length > MAX_BATCH_PLANS) throw new Error(`Too many plans (max ${MAX_BATCH_PLANS})`);

  const data = plans.map((plan) => {
    if (!isRecord(plan)) throw new Error("Invalid plans payload");

    return {
      name: requireString(typeof plan.name === 'string' ? plan.name : null, "Plan name", 120),
      type: parsePlanType(plan.type),
      validityDays: parsePositiveInt(String(plan.validityDays ?? ''), "Validity days", 1, 3650),
      durationHours: parseOptionalInt(plan.durationHours != null ? String(plan.durationHours) : '', "Duration hours", 1, 24),
      price: parseMoney(String(plan.price ?? ''), "Price"),
      discount: parseDiscount(plan.discount != null ? String(plan.discount) : ''),
      libraryId: library.id,
    };
  });

  await prisma.plan.createMany({ data });

  await invalidateLibraryRuntimeCache(library.id);
  updateTag(`library:${library.id}`);
  updateTag('libraries:featured');
  revalidatePath(`/library/${library.id}`);
  revalidatePath("/dashboard/plans");
}

export async function deletePlan(planId: string): Promise<void> {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

  const library = await prisma.library.findFirst({ where: session.role === 'ADMIN' ? {} : { librarianId: session.userId } });
  if (!library) throw new Error("No library found");

  // Only operate on a plan that belongs to this library.
  const plan = await prisma.plan.findFirst({ where: { id: planId, libraryId: library.id } });
  if (!plan) throw new Error("Plan not found");

  // Hard-deleting a plan that has bookings would violate the Booking->Plan
  // foreign key and erase financial history, so soft-delete it (hidden from new
  // bookings, row kept). Plans that were never booked are safe to remove fully.
  const bookingCount = await prisma.booking.count({ where: { planId } });
  if (bookingCount > 0) {
    await prisma.plan.update({ where: { id: planId }, data: { isActive: false } });
  } else {
    await prisma.plan.delete({ where: { id: planId } });
  }

  await invalidateLibraryRuntimeCache(library.id);
  updateTag(`library:${library.id}`);
  updateTag('libraries:featured');
  revalidatePath(`/library/${library.id}`);
  revalidatePath("/dashboard/plans");
}

export async function editPlan(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

  const library = await prisma.library.findFirst({ where: session.role === 'ADMIN' ? {} : { librarianId: session.userId } });
  if (!library) throw new Error("No library found");

  const id = requireString(formData.get("id"), "Plan id", 64);
  const name = requireString(formData.get("name"), "Plan name", 120);
  const type = parsePlanType(formData.get("type"));
  const validityDays = parsePositiveInt(formData.get("validityDays"), "Validity days", 1, 3650);
  const price = parseMoney(formData.get("price"), "Price");
  const discount = parseDiscount(formData.get("discount"));
  const durationHours = parseOptionalInt(formData.get("durationHours"), "Duration hours", 1, 24);

  await prisma.plan.updateMany({
    where: { id, libraryId: library.id },
    data: { name, type, validityDays, durationHours, price, discount }
  });

  await invalidateLibraryRuntimeCache(library.id);
  updateTag(`library:${library.id}`);
  updateTag('libraries:featured');
  revalidatePath(`/library/${library.id}`);
  revalidatePath("/dashboard/plans");
}
