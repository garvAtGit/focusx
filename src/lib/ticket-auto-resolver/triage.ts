import prisma from '@/lib/prisma';
import { TicketCategory } from '@prisma/client';
import { ProblemType, TriageResult, ExtractedStudent } from './types';

// Specific student/booking payment indicators (never broad generic words like "payment" alone)
const KEYWORDS_PAYMENT = [
  'student payment', 'booking payment', 'seat payment', 'payment debited', 'amount debited',
  'paise kat gaye', 'paise cut', 'paise kat gya', 'booking pending', 'razorpay',
  'paid but', 'money deducted', 'payment cut', 'rupees deducted', 'fee deducted',
  'paisa kat gaya', 'paise cut gaye'
];

const KEYWORDS_HARDWARE = [
  'scanner', 'gate', 'turnstile', 'rfid reader', 'relay', 'machine',
  'biometric', 'offline', 'nahi khul raha', 'gate open', 'scanner band',
  'reader offline', 'gate nahi khula', 'esp32', 'scanner offline'
];

const KEYWORDS_ATTENDANCE = [
  'attendance', 'checkin', 'check in', 'check-in', 'checkout', 'check out',
  'check-out', 'entry nahi hui', 'stale session', 'attendance issue',
  'punched in', 'rfid nahi chala', 'student entry', 'hajiri', 'session'
];

/**
 * Matches keywords using strict word boundaries to avoid substring false positives
 * (e.g. "investigate" must NOT match "gate").
 */
export function findMatches(text: string, keywords: string[]): string[] {
  const normalized = text.toLowerCase();
  return keywords.filter((kw) => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    return regex.test(normalized);
  });
}

/**
 * Extracts student from text scoped strictly to the given libraryId.
 * Follows the 0 / 1 / >1 rule.
 */
export async function extractStudentFromText(
  text: string,
  libraryId: string
): Promise<{
  student: ExtractedStudent | null;
  ambiguity: 'NONE' | 'ZERO_FOUND' | 'MULTIPLE_FOUND';
}> {
  // Look for 10-digit Indian phone numbers
  const phoneMatches = text.match(/\b(?:[6-9]\d{9})\b/g);
  // Look for UUID-like student IDs
  const uuidMatches = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi);

  const candidatePhones = Array.from(new Set(phoneMatches || []));
  const candidateIds = Array.from(new Set(uuidMatches || []));

  if (candidatePhones.length === 0 && candidateIds.length === 0) {
    return { student: null, ambiguity: 'ZERO_FOUND' };
  }

  if (candidatePhones.length > 1 || candidateIds.length > 1) {
    return { student: null, ambiguity: 'MULTIPLE_FOUND' };
  }

  // Find candidate users within library tenancy
  const students = await prisma.user.findMany({
    where: {
      OR: [
        ...(candidatePhones.length === 1 ? [{ phone: candidatePhones[0] }] : []),
        ...(candidateIds.length === 1 ? [{ id: candidateIds[0] }] : []),
      ],
      // Tenancy constraint: student must have bookings, checkins, or intents in this library
      AND: [
        {
          OR: [
            { bookings: { some: { libraryId } } },
            { checkins: { some: { libraryId } } },
            { bookingIntents: { some: { libraryId } } },
          ],
        },
      ],
    },
    select: {
      id: true,
      name: true,
      phone: true,
    },
    take: 2,
  });

  if (students.length === 0) {
    return { student: null, ambiguity: 'ZERO_FOUND' };
  }

  if (students.length > 1) {
    return { student: null, ambiguity: 'MULTIPLE_FOUND' };
  }

  return { student: students[0], ambiguity: 'NONE' };
}

/**
 * Triages ticket title, description, and selected category.
 * Detects Hinglish intents, multi-intents, and computes confidence score.
 * Strict rule: category-only matches without matching keywords MUST cap confidence < 0.6.
 */
export async function triageTicket(input: {
  title: string;
  description: string;
  category: TicketCategory;
  libraryId: string;
}): Promise<TriageResult> {
  const combinedText = `${input.title} ${input.description}`.toLowerCase();

  // Attempt student extraction first
  const { student, ambiguity } = await extractStudentFromText(combinedText, input.libraryId);

  const payMatches = findMatches(combinedText, KEYWORDS_PAYMENT);
  const hwMatches = findMatches(combinedText, KEYWORDS_HARDWARE);
  const attMatches = findMatches(combinedText, KEYWORDS_ATTENDANCE);

  // Strict guard for PAYMENT_PENDING:
  // Must have explicit student/booking context or an identified student.
  // Librarian bank payout/settlement complaints must never qualify as student booking payment issues,
  // even if they mention razorpay, students, or bookings.
  const isPayoutOrSettlementDispute =
    /\b(payout|settlement|bank transfer|bank account|vendor payout|weekly payout|monthly payout|branch payout|payout dispute)\b/i.test(combinedText);

  const hasStudentOrBookingContext =
    !isPayoutOrSettlementDispute &&
    (Boolean(student) ||
      /\b(student|booking|seat|admission|intent|seat booking)\b/i.test(combinedText));

  const detectedCategories: ProblemType[] = [];
  if (payMatches.length > 0 && hasStudentOrBookingContext) {
    detectedCategories.push('PAYMENT_PENDING');
  }
  if (hwMatches.length > 0) detectedCategories.push('SCANNER_OFFLINE');
  if (attMatches.length > 0) detectedCategories.push('ATTENDANCE_CHECKIN');

  const isMultiIntent = detectedCategories.length > 1;

  // Single category extraction
  let problemType: ProblemType = 'UNKNOWN';
  let matchedKeywords: string[] = [];

  if (detectedCategories.length === 1) {
    problemType = detectedCategories[0];
    if (problemType === 'PAYMENT_PENDING') matchedKeywords = payMatches;
    if (problemType === 'SCANNER_OFFLINE') matchedKeywords = hwMatches;
    if (problemType === 'ATTENDANCE_CHECKIN') matchedKeywords = attMatches;
  } else if (detectedCategories.length === 0) {
    // Category-only matches without matching keywords MUST remain UNKNOWN
    problemType = 'UNKNOWN';
    matchedKeywords = [];
  }

  // Calculate confidence
  let confidence = 0.35;
  if (!isMultiIntent && problemType !== 'UNKNOWN') {
    confidence = 0.7;
    // Boost if keywords match category
    if (
      (problemType === 'PAYMENT_PENDING' && input.category === 'BILLING_PAYOUTS') ||
      (problemType === 'SCANNER_OFFLINE' && input.category === 'HARDWARE') ||
      (problemType === 'ATTENDANCE_CHECKIN' && input.category === 'STUDENTS_BOOKINGS')
    ) {
      confidence += 0.2;
    }
    // Boost if multiple matching keywords found
    if (matchedKeywords.length >= 2) {
      confidence = Math.min(1.0, confidence + 0.1);
    }
  } else {
    // If unknown, no keywords, or multi-intent, cap confidence strictly below 0.6
    confidence = 0.35;
  }

  return {
    problemType,
    confidence,
    matchedKeywords,
    isMultiIntent,
    detectedCategories,
    extractedStudentId: student?.id ?? null,
    extractedStudent: student,
    studentAmbiguity: ambiguity,
  };
}
