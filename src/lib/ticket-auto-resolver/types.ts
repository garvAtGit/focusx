import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';

export type ProblemType = 'PAYMENT_PENDING' | 'SCANNER_OFFLINE' | 'ATTENDANCE_CHECKIN' | 'UNKNOWN';

export interface BotFlags {
  enabled: boolean;
  shadowMode: boolean;
  paymentsEnabled: boolean;
  hardwareEnabled: boolean;
  attendanceEnabled: boolean;
}

export interface ExtractedStudent {
  id: string;
  name: string;
  phone: string | null;
}

export interface TriageResult {
  problemType: ProblemType;
  confidence: number;
  matchedKeywords: string[];
  isMultiIntent: boolean;
  detectedCategories: ProblemType[];
  extractedStudentId?: string | null;
  extractedStudent?: ExtractedStudent | null;
  studentAmbiguity?: 'NONE' | 'ZERO_FOUND' | 'MULTIPLE_FOUND';
}

export interface ResolverOutput {
  action: string;
  resolved: boolean;
  status: TicketStatus;
  message?: string;
  isInternalNote: boolean;
  metadata?: Record<string, unknown>;
}

