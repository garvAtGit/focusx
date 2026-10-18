"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getSession } from "./auth-actions"

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
    if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) return { success: false };
    // Retained for compatibility with existing callers; authorization uses the
    // inquiry's database-owned library id below.
    void libraryId;

    const validStatuses = ['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED'];
    if (!validStatuses.includes(status)) return { success: false };

    // Authorize against the inquiry's ACTUAL library, not the client-supplied
    // libraryId. Without this, a librarian could pass their own libraryId while
    // targeting an inquiryId that belongs to a different library (IDOR).
    const inquiry = await prisma.inquiry.findUnique({
      where: { id: inquiryId },
      select: { libraryId: true },
    });
    if (!inquiry) return { success: false };

    if (session.role === 'LIBRARIAN') {
      const lib = await prisma.library.findFirst({
        where: { id: inquiry.libraryId, librarianId: session.userId },
        select: { id: true },
      });
      if (!lib) return { success: false };
    }

    await prisma.inquiry.update({
      where: { id: inquiryId },
      data: { status }
    });

    revalidatePath("/dashboard/inquiries");
    return { success: true };
  } catch (error: unknown) {
    console.error("Update inquiry error:", error);
    return { success: false };
  }
}
