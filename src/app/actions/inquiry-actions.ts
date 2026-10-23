"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getSession } from "./auth-actions"
import { requirePermission } from "@/lib/permissions"

type InquiryActionResult =
  | { success: true; error?: never }
  | { success: false; error?: string };

export async function submitInquiry(formData: FormData): Promise<InquiryActionResult> {
  try {
    const libraryId = formData.get("libraryId");
    const name = formData.get("name");
    const phone = formData.get("phone");
    const messageEntry = formData.get("message");

    if (
      typeof libraryId !== "string" ||
      typeof name !== "string" ||
      typeof phone !== "string" ||
      !libraryId ||
      !name ||
      !phone
    ) {
      return { success: false, error: "Missing required fields" };
    }
    const message = typeof messageEntry === "string" ? messageEntry : null;

    await prisma.inquiry.create({
      data: {
        libraryId,
        name,
        phone,
        message,
      }
    });

    return { success: true };
  } catch (error: unknown) {
    console.error("Inquiry error:", error);
    return { success: false, error: "Failed to submit inquiry" };
  }
}

export async function updateInquiryStatus(
  inquiryId: string,
  status: 'NEW' | 'CONTACTED' | 'CONVERTED' | 'CLOSED',
  libraryId: string,
): Promise<InquiryActionResult> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Unauthorized" };
    void libraryId;

    const validStatuses = ['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED'];
    if (!validStatuses.includes(status)) return { success: false, error: "Invalid status" };

    // Authorize against the inquiry's ACTUAL library (prevents IDOR)
    const inquiry = await prisma.inquiry.findUnique({
      where: { id: inquiryId },
      select: { libraryId: true },
    });
    if (!inquiry) return { success: false, error: "Inquiry not found" };

    const authCheck = await requirePermission(session, inquiry.libraryId, 'inquiries.manage');
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error };
    }

    await prisma.inquiry.update({
      where: { id: inquiryId },
      data: { status }
    });

    revalidatePath("/dashboard/inquiries");
    return { success: true };
  } catch (error: unknown) {
    console.error("Inquiry update error:", error);
    return { success: false, error: "Failed to update inquiry status" };
  }
}
