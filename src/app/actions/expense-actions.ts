"use server"

import prisma from "@/lib/prisma"
import { getSession } from "./auth-actions"
import { revalidatePath } from "next/cache"

type ExpenseActionResult =
  | { success: true; error?: never }
  | { success: false; error: string };

export async function addExpense(formData: FormData): Promise<ExpenseActionResult> {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) {
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

    // Verify librarian owns this library (if not admin)
    if (session.role === 'LIBRARIAN') {
      const lib = await prisma.library.findFirst({
        where: { id: libraryId, librarianId: session.userId }
      });
      if (!lib) return { success: false, error: "Unauthorized for this library" };
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
    if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) {
      return { success: false, error: "Unauthorized" };
    }

    if (session.role === 'LIBRARIAN') {
      const lib = await prisma.library.findFirst({
        where: { id: libraryId, librarianId: session.userId }
      });
      if (!lib) return { success: false, error: "Unauthorized for this library" };
    }

    await prisma.expense.delete({
      where: { id: expenseId, libraryId: libraryId }
    });

    revalidatePath("/dashboard/financials");
    
    return { success: true };
  } catch (error: unknown) {
    console.error("Expense delete error:", error);
    return {
      success: false,
      error: error instanceof Error && error.message ? error.message : "Failed to delete expense",
    };
  }
}
