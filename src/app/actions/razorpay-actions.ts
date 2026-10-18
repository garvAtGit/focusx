'use server'

import prisma from "@/lib/prisma"
import { getSession } from "./auth-actions"
import Razorpay from "razorpay"
import { headers } from "next/headers"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getRazorpayErrorDescription(value: unknown): string | undefined {
  if (!isRecord(value) || !isRecord(value.error)) return undefined;
  return typeof value.error.description === "string" ? value.error.description : undefined;
}

function getRazorpayClient(): Razorpay {
  const key_id = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error('Razorpay keys are not configured (NEXT_PUBLIC_RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)');
  }
  return new Razorpay({ key_id, key_secret });
}

export async function createRazorpayLinkedAccount(): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const library = await prisma.library.findFirst({
    where: session.role === 'ADMIN' ? {} : { librarianId: session.userId },
    include: { librarian: true }
  });

  if (!library) throw new Error("Library not found");
  if (library.paymentAccountId) return library.paymentAccountId; // Already has an account

  try {
    const account = await getRazorpayClient().accounts.create({
      email: library.librarian.email || "no-reply@focusdesk.in",
      phone: library.librarian.phone || library.managerPhone || "9999999999",
      type: "route",
      legal_business_name: library.name,
      business_type: "individual", // default for MVP
      contact_name: library.managerName || library.librarian.name || "Manager",
      profile: {
        category: "education",
        subcategory: "educational_institutions",
        addresses: {
          registered: {
            street1: library.address,
            street2: library.locality || "Locality",
            city: library.city || "Demo City",
            state: library.state || "Demo State",
            postal_code: library.pinCode || "110001",
            country: "IN"
          }
        }
      },
      notes: {
        libraryId: library.id
      }
    });

    await prisma.library.update({
      where: { id: library.id },
      data: { paymentAccountId: account.id }
    });

    return account.id;
  } catch (error: unknown) {
    console.error("Razorpay account creation failed:", error);
    throw new Error(
      getRazorpayErrorDescription(error) ||
        "Failed to create Razorpay account. Check if Route is enabled.",
    );
  }
}

export async function getRazorpayOnboardingLink(): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const library = await prisma.library.findFirst({
    where: session.role === 'ADMIN' ? {} : { librarianId: session.userId }
  });

  if (!library || !library.paymentAccountId) {
    throw new Error("No payment account found");
  }

  // The razorpay node SDK doesn't expose account onboarding links directly in older versions,
  // so we'll use a direct fetch to the Razorpay API.
  const auth = Buffer.from(`${process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  
  // We do not have direct access to request headers inside a Server Action easily unless we import `headers()`.
  const headersList = await headers();
  const forwardedHost = headersList.get('x-forwarded-host');
  const host = forwardedHost || headersList.get('host') || 'localhost:3000';
  const protocol = headersList.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const envAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const appUrl = (envAppUrl && !envAppUrl.includes('localhost')) ? envAppUrl : `${protocol}://${host}`;
  
  const response = await fetch(`https://api.razorpay.com/beta/accounts/${library.paymentAccountId}/onboarding_links`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      cancel_url: `${appUrl}/dashboard/settings?kyc=cancelled`,
      return_url: `${appUrl}/dashboard/settings?kyc=success`
    })
  });

  const data: unknown = await response.json();
  
  if (!response.ok) {
    console.error("Failed to generate onboarding link:", data);
    throw new Error(getRazorpayErrorDescription(data) || "Failed to generate onboarding link");
  }

  if (!isRecord(data) || typeof data.short_url !== "string") {
    throw new Error("Razorpay returned an invalid onboarding link");
  }

  return data.short_url;
}
