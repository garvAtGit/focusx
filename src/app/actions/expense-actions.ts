"use server"

import prisma from "@/lib/prisma"
import { getSession } from "./auth-actions"
import { revalidatePath } from "next/cache"
import { requirePermission } from "@/lib/permissions"

type ExpenseActionResult =
  | { success: true; error?: never }
  | { success: false; error: string };

export async function addExpense(formData: FormData): Promise<ExpenseActionResult> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    const libraryId = formData.get("libraryId");
    const name = formData.get("name");
    const amountStr = formData.get("amount");

    if (
      typeof libraryId !== "string" ||
      typeof name !== "string" ||
      typeof amountStr !== "string" ||
      !libraryId ||
      !name ||
      !amountStr
    ) {
      return { success: false, error: "Missing required fields" };
    }

    const amount = parseFloat(amountStr);
    if (Number.isNaN(amount) || amount <= 0) {
      return { success: false, error: "Invalid amount" };
    }

    // Granular permission check: require 'financials.manage' for this library
    const authCheck = await requirePermission(session, libraryId, 'financials.manage');
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error };
    }

    await prisma.expense.create({
      data: {
        libraryId,
        name,
        amount,
      }
    });

    revalidatePath("/dashboard/financials");
    revalidatePath("/dashboard");
    
    return { success: true };
  } catch (error: unknown) {
    console.error("Expense error:", error);
    return {
      success: false,
      error: error instanceof Error && error.message ? error.message : "Failed to add expense",
    };
  }
}

export async function deleteExpense(expenseId: string, libraryId: string): Promise<ExpenseActionResult> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    // Granular permission check: require 'financials.manage' for this library
    const authCheck = await requirePermission(session, libraryId, 'financials.manage');
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error };
    }

    await prisma.expense.delete({
      where: { id: expenseId, libraryId: libraryId }
    });

    revalidatePath("/dashboard/financials");
    revalidatePath("/dashboard");
    
    return { success: true };
  } catch (error: unknown) {
    console.error("Expense delete error:", error);
    return {
      success: false,
      error: error instanceof Error && error.message ? error.message : "Failed to delete expense",
    };
  }
}
