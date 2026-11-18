import prisma from '@/lib/prisma';
import * as Sentry from '@sentry/nextjs';
import { getBotFlags } from './flags';
import { triageTicket } from './triage';
import { ResolverOutput } from './types';

/**
 * Main entry point for autonomous ticket triage and resolution.
 * Hooked non-blockingly inside createTicketAction via Next.js after().
 */
export async function autoResolveTicket(ticketId: string): Promise<ResolverOutput> {
  // 1. Evaluate Flags FIRST before any DB mutations
  // If bot is disabled, do NOT stamp botProcessedAt or claim the ticket.
  const flags = await getBotFlags();
  if (!flags.enabled) {
    return {
      action: 'BOT_DISABLED',
      resolved: false,
      status: 'OPEN',
      isInternalNote: true,
    };
  }

  // 2. Atomic lease claim to prevent concurrent runs and guarantee at-most-once execution
  const claimed = await prisma.supportTicket.updateMany({
    where: {
      id: ticketId,
      botProcessedAt: null,
    },
    data: {
      botProcessedAt: new Date(),
      botAction: 'IN_PROGRESS',
    },
  });

  if (claimed.count === 0) {
    return {
      action: 'ALREADY_CLAIMED_OR_PROCESSED',
      resolved: false,
      status: 'OPEN',
      isInternalNote: true,
    };
  }

  let finalAction = 'UNPROCESSED';
  let isResolved = false;

  try {
    // 3. Fetch ticket and library context
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        library: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true, phone: true } },
      },
    });

    if (!ticket) {
      finalAction = 'TICKET_NOT_FOUND';
      return { action: finalAction, resolved: false, status: 'OPEN', isInternalNote: true };
    }

    // 4. Run Triage
    const triage = await triageTicket({
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      libraryId: ticket.libraryId,
    });

    // 5. Handle Multi-Intent Detection
    if (triage.isMultiIntent) {
      finalAction = 'MULTI_INTENT_ESCALATED';
      await prisma.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          senderId: ticket.creatorId,
          senderRole: 'BOT',
          content: `[FocusX Bot] Multiple problem intents detected (${triage.detectedCategories.join(', ')}). Bailing out to Human Admin for comprehensive handling.`,
          isInternalNote: true,
        },
      });
      return {
        action: finalAction,
        resolved: false,
        status: 'OPEN',
        isInternalNote: true,
      };
    }

    // 6. Handle Low Confidence / Unknown
    if (triage.confidence < 0.6 || triage.problemType === 'UNKNOWN') {
      finalAction = 'LOW_CONFIDENCE_FALLBACK';
      if (flags.shadowMode) {
        await prisma.ticketMessage.create({
          data: {
            ticketId: ticket.id,
            senderId: ticket.creatorId,
            senderRole: 'BOT',
            content: `[FocusX Bot - Shadow Mode] Confidence too low (${Math.round(triage.confidence * 100)}%) for automated handling. Left OPEN for staff.`,
            isInternalNote: true,
          },
        });
      }
      return {
        action: finalAction,
        resolved: false,
        status: 'OPEN',
        isInternalNote: true,
      };
    }

    // 7. Phase 1 Shadow Execution & Diagnostic Verification
    // (Phases 2 and 3 will plug in the active handlers for hardware, attendance, and payments)
    const studentInfo = triage.extractedStudent
      ? `${triage.extractedStudent.name} (${triage.extractedStudent.phone || triage.extractedStudent.id})`
      : triage.studentAmbiguity === 'MULTIPLE_FOUND'
      ? 'Ambiguous (multiple matched)'
      : 'None identified in text';

    const shadowNote = `[FocusX Bot - Shadow Mode Diagnosis]
Problem Type: ${triage.problemType}
Confidence: ${Math.round(triage.confidence * 100)}%
Keywords: ${triage.matchedKeywords.join(', ') || 'Category-based'}
Student: ${studentInfo}
Target Action: Ready for Phase 2/3 execution. No state changes made.`;

    await prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        senderId: ticket.creatorId,
        senderRole: 'BOT',
        content: shadowNote,
        isInternalNote: true,
      },
    });

    finalAction = `SHADOW_${triage.problemType}`;
    isResolved = false;

    return {
      action: finalAction,
      resolved: isResolved,
      status: ticket.status,
      isInternalNote: true,
    };
  } catch (error: any) {
    Sentry.captureException(error, {
      tags: { feature: 'ticket-auto-resolver', ticketId },
    });
    console.error('[TicketAutoResolver] Unexpected error during resolution:', error);
    finalAction = 'ERROR_FALLBACK';
    return {
      action: finalAction,
      resolved: false,
      status: 'OPEN',
      isInternalNote: true,
    };
  } finally {
    // 8. Always finalize the atomic lock so ticket never hangs as "IN_PROGRESS"
    try {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
          botAction: finalAction,
          autoResolved: isResolved,
          botProcessedAt: new Date(),
        },
      });
    } catch (finalizeErr) {
      console.error('[TicketAutoResolver] Failed to finalize botAction in finally block:', finalizeErr);
    }
  }
}

