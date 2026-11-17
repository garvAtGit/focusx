import { useState, useEffect, useMemo, useCallback } from 'react';
import { getBookingFacts } from '@/app/actions/booking-actions';
import { evaluateBookingSelection } from '@/lib/booking-engine/evaluate-selection';
import type { BookingDraft, BookingResult, BookingFacts } from '@/lib/booking-engine/types';

export function useBookingWorkflow(initialDraft: Partial<BookingDraft>, enabled: boolean = true) {
  const [draft, setDraft] = useState<Partial<BookingDraft>>(initialDraft);
  const [facts, setFacts] = useState<BookingFacts | null>(null);
  const [isLoadingFacts, setIsLoadingFacts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync initialDraft updates into draft state
  useEffect(() => {
    setDraft(prev => {
      let changed = false;
      const next = { ...prev };
      if (initialDraft.libraryId !== prev.libraryId) { next.libraryId = initialDraft.libraryId; changed = true; }
      if (initialDraft.studentId !== prev.studentId) { next.studentId = initialDraft.studentId; changed = true; }
      if (initialDraft.sourceBookingId !== prev.sourceBookingId) { next.sourceBookingId = initialDraft.sourceBookingId; changed = true; }
      if (initialDraft.operation !== prev.operation) { next.operation = initialDraft.operation; changed = true; }
      if (initialDraft.planId !== prev.planId && prev.planId === undefined) { next.planId = initialDraft.planId; changed = true; }
      if (initialDraft.seatId !== prev.seatId && prev.seatId === undefined) { next.seatId = initialDraft.seatId; changed = true; }
      return changed ? next : prev;
    });
  }, [initialDraft.libraryId, initialDraft.studentId, initialDraft.sourceBookingId, initialDraft.operation, initialDraft.planId, initialDraft.seatId]);

  // 1. Fetch Facts once (or when primary context changes)
  useEffect(() => {
    let active = true;
    if (!draft.libraryId || !enabled) return;

    async function fetchFacts() {
      setIsLoadingFacts(true);
      setError(null);
      try {
        const fetchedFacts = await getBookingFacts({ 
          libraryId: draft.libraryId, 
          studentId: draft.studentId,
          sourceBookingId: draft.sourceBookingId,
          operation: draft.operation,
          planId: draft.planId,
          seatId: draft.seatId,
        });
        if (active) {
          setFacts(fetchedFacts);
        }
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load library data');
        }
      } finally {
        if (active) setIsLoadingFacts(false);
      }
    }

    fetchFacts();

    return () => { active = false; };
  }, [draft.libraryId, draft.studentId, draft.sourceBookingId, enabled]);

  // 2. Synchronous local evaluation
  const workflowState = useMemo<BookingResult | null>(() => {
    if (!facts) return null;
    return evaluateBookingSelection(draft, facts);
  }, [draft, facts]);

  const updateDraft = useCallback((updates: Partial<BookingDraft>) => {
    setDraft(prev => ({ ...prev, ...updates }));
  }, []);

  return {
    draft,
    facts,
    workflowState,
    isEvaluating: isLoadingFacts,
    error,
    updateDraft
  };
}
