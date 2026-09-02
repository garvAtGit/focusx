export type PolicyVersion = '1.0.0';

export type BookingOperation = 'ADD_STUDENT' | 'RENEW' | 'CHANGE_SEAT' | 'CHANGE_PLAN' | 'UPGRADE_PLAN';

export interface BookingDraft {
  operation: BookingOperation;
  studentId: string;
  libraryId: string;
  sourceBookingId?: string | null;
  planId?: string | null;
  seatId?: string | null;
  /**
   * undefined = not answered (ask the user if seat has locker)
   * true = explicitly selected
   * false = explicitly declined
   */
  attachedLockerSelected?: boolean | null;
  wantsStandaloneLocker?: boolean | null;
  standaloneLockerId?: string | null;
  requestedStart?: Date | null;
  paymentMethod?: string | null;
}

export type ActorRole = 'STUDENT' | 'LIBRARIAN' | 'RECEPTIONIST' | 'ADMIN';

export interface ActorCapabilities {
  role: ActorRole;
  isLibraryOwner: boolean;
}

export interface PlanFact {
  id: string;
  libraryId: string;
  name: string;
  type: 'FIXED' | 'FLEXIBLE';
  validityDays: number;
  durationHours: number | null;
  pricePaise: number; // Converted to paise by fact loader
  discountPercentage: number | null;
  isActive: boolean;
}

export interface SeatFact {
  id: string;
  libraryId: string;
  name: string;
  type: 'RESERVED' | 'NORMAL' | 'PREMIUM' | 'NON_RESERVABLE';
  hasLocker: boolean;
  lockerPriceDailyPaise: number | null; // Converted to paise
  premiumPriceDailyPaise: number | null; // Converted to paise
  syncPremiumOffers: boolean;
}

export interface StandaloneLockerFact {
  id: string;
  libraryId: string;
  name: string;
  pricePaise: number; // Converted to paise
}

export interface BookingFact {
  id: string;
  studentId: string;
  libraryId: string;
  planId: string;
  seatId: string | null;
  hasLocker: boolean;
  standaloneLockerId: string | null;
  startTime: Date;
  endTime: Date;
  status: 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
}

export interface BookingFacts {
  policyVersion: PolicyVersion;
  authoritativeCurrentTime: Date;
  actorCapabilities: ActorCapabilities;
  student: {
    id: string;
    isActive: boolean;
  } | null;
  sourceBooking: BookingFact | null;
  activePlans: PlanFact[];
  selectedPlan: PlanFact | null;
  eligibleSeats: SeatFact[];
  seatAvailabilitySnapshot: Record<string, boolean>; // seatId -> isAvailable
  selectedSeat: SeatFact | null;
  standaloneLockers: StandaloneLockerFact[];
  resourceAvailability: Record<string, boolean>; // e.g., 'STANDALONE_LOCKER:id' -> isAvailable
  currentBookingWindow: {
    startsAt: Date;
    endsAt: Date;
  } | null;
}

export interface NeedsInputResult {
  status: 'NEEDS_INPUT';
  normalizedDraft: BookingDraft;
  requiredFields: Array<keyof BookingDraft>;
  validOptions: Record<string, unknown>;
  reasons: string[];
  previewFragments: Record<string, unknown>;
}

export interface ReadyResult {
  status: 'READY';
  normalizedDraft: BookingDraft;
  authoritativePreview: Record<string, unknown>;
  amountPaise: number;
  dates: {
    startsAt: Date;
    endsAt: Date;
  };
  resourceSummary: Array<{ type: 'SEAT' | 'STANDALONE_LOCKER', id: string }>;
  policyVersion: PolicyVersion;
  evaluationFingerprint: string;
}

export interface BlockedResult {
  status: 'BLOCKED';
  errorCode: string;
  userFacingExplanation: string;
  recoverableNextAction?: string;
}

export type BookingResult = NeedsInputResult | ReadyResult | BlockedResult;
