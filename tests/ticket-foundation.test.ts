import assert from 'node:assert/strict';
import test from 'node:test';
import { triageTicket, extractStudentFromText, findMatches } from '../src/lib/ticket-auto-resolver/triage';
import { getBotFlags, resetFlagsMemoryCache, parseBotFlags, parseBooleanFlag } from '../src/lib/ticket-auto-resolver/flags';
import { computeReplyEscalation } from '../src/lib/ticket-auto-resolver/escalation';
import { autoResolveTicket } from '../src/lib/ticket-auto-resolver';
import { getTicketMessageWhereClause } from '../src/lib/ticket-query-helpers';
import { addTicketMessageInternal } from '../src/lib/ticket-auto-resolver/message-service';
import prisma from '../src/lib/prisma';

// 1. Triage Hinglish payment pending intent
test('1. Triage correctly classifies Hinglish payment pending intent (Real Code: triageTicket)', async () => {
  const result = await triageTicket({
    title: 'paise kat gaye par seat nahi mili',
    description: 'Student paid via razorpay but booking pending dikha raha hai',
    category: 'BILLING_PAYOUTS',
    libraryId: 'lib_test_1',
  });

  assert.equal(result.problemType, 'PAYMENT_PENDING');
  assert.equal(result.isMultiIntent, false);
  assert.ok(result.confidence >= 0.8);
  assert.ok(result.matchedKeywords.includes('paise kat gaye') || result.matchedKeywords.includes('razorpay'));
});

// 2. Triage hardware offline intent
test('2. Triage correctly classifies hardware offline intent (Real Code: triageTicket)', async () => {
  const result = await triageTicket({
    title: 'Scanner offline',
    description: 'Turnstile gate nahi khul raha student rfid card scan karne par',
    category: 'HARDWARE',
    libraryId: 'lib_test_1',
  });

  assert.equal(result.problemType, 'SCANNER_OFFLINE');
  assert.equal(result.isMultiIntent, false);
  assert.ok(result.confidence >= 0.8);
});

// 3. Word boundary matching: "investigate" does not match "gate"
test("3. Word boundary matching: 'investigate' does not match 'gate' (Real Code: findMatches)", () => {
  const matches = findMatches('Please investigate the lock and turnstile', ['gate', 'turnstile']);
  // "gate" must NOT match inside "investigate"
  assert.ok(!matches.includes('gate'), "Word 'gate' must not match inside 'investigate'");
  assert.ok(matches.includes('turnstile'), "Exact word 'turnstile' must match");
});

// 4. Category-only match: "how do I add a student" in STUDENTS_BOOKINGS
test("4. Category-only match: 'how do I add a student' in STUDENTS_BOOKINGS -> UNKNOWN and low confidence (Real Code: triageTicket)", async () => {
  const result = await triageTicket({
    title: 'how do I add a student',
    description: 'Need help adding a new student to our system',
    category: 'STUDENTS_BOOKINGS',
    libraryId: 'lib_test_1',
  });

  assert.equal(result.problemType, 'UNKNOWN');
  assert.ok(result.confidence < 0.6, `Confidence must be capped below 0.6, got ${result.confidence}`);
  assert.equal(result.matchedKeywords.length, 0);
});

// 5. Multi-intent detection
test('5. Triage correctly detects multi-intent tickets and flags them (Real Code: triageTicket)', async () => {
  const result = await triageTicket({
    title: 'Scanner offline and paise kat gaye',
    description: 'Gate nahi khul raha aur student ke payment debited but booking pending',
    category: 'HARDWARE',
    libraryId: 'lib_test_1',
  });

  assert.equal(result.isMultiIntent, true);
  assert.ok(result.detectedCategories.includes('PAYMENT_PENDING'));
  assert.ok(result.detectedCategories.includes('SCANNER_OFFLINE'));
});

// 6. Low confidence on ambiguous text
test('6. Triage low confidence on ambiguous or unrelated text (Real Code: triageTicket)', async () => {
  const result = await triageTicket({
    title: 'Library interior color',
    description: 'We need new paint on the wall',
    category: 'OTHER',
    libraryId: 'lib_test_1',
  });

  assert.equal(result.problemType, 'UNKNOWN');
  assert.ok(result.confidence < 0.6);
  assert.equal(result.isMultiIntent, false);
});

// 7. Upstash Redis flag parsing with boolean and string values
test('7. parseBotFlags parses both string and boolean representations from Upstash (Real Code: parseBotFlags)', () => {
  // Case A: Upstash deserialized booleans
  const booleanFlags = parseBotFlags({
    enabled: true,
    shadow_mode: false,
    payments_enabled: true,
    hardware_enabled: false,
    attendance_enabled: true,
  });
  assert.equal(booleanFlags.enabled, true);
  assert.equal(booleanFlags.shadowMode, false);
  assert.equal(booleanFlags.paymentsEnabled, true);
  assert.equal(booleanFlags.hardwareEnabled, false);
  assert.equal(booleanFlags.attendanceEnabled, true);

  // Case B: Raw strings from redis-cli
  const stringFlags = parseBotFlags({
    enabled: 'true',
    shadow_mode: 'false',
    payments_enabled: '1',
    hardware_enabled: '0',
    attendance_enabled: 'yes',
  });
  assert.equal(stringFlags.enabled, true);
  assert.equal(stringFlags.shadowMode, false);
  assert.equal(stringFlags.paymentsEnabled, true);
  assert.equal(stringFlags.hardwareEnabled, false);
  assert.equal(stringFlags.attendanceEnabled, true);

  // Case C: Null/undefined falls back safely closed
  const defaultFlags = parseBotFlags(null, false, true);
  assert.equal(defaultFlags.enabled, false);
  assert.equal(defaultFlags.shadowMode, true);
  assert.equal(defaultFlags.paymentsEnabled, false);
});

// 8. Bot flags fail closed for write actions
test('8. Bot flags fail closed for write actions when Redis keys are missing or offline (Real Code: getBotFlags)', async () => {
  resetFlagsMemoryCache();
  const flags = await getBotFlags();

  assert.equal(flags.paymentsEnabled, false);
  assert.equal(flags.hardwareEnabled, false);
  assert.equal(flags.attendanceEnabled, false);
  assert.equal(flags.shadowMode, true);
});

// 9. Single-student extraction: ZERO_FOUND
test('9. extractStudentFromText identifies ZERO_FOUND when no phone or UUID is present (Real Code: extractStudentFromText)', async () => {
  const res = await extractStudentFromText('Gate nahi khul raha kindly check', 'lib_123');
  assert.equal(res.student, null);
  assert.equal(res.ambiguity, 'ZERO_FOUND');
});

// 10. Single-student extraction: MULTIPLE_FOUND
test('10. extractStudentFromText identifies MULTIPLE_FOUND when multiple candidate phones or IDs are present (Real Code: extractStudentFromText)', async () => {
  const resPhone = await extractStudentFromText('Student 9876543210 and 9123456789 paid fees', 'lib_123');
  assert.equal(resPhone.student, null);
  assert.equal(resPhone.ambiguity, 'MULTIPLE_FOUND');

  const resUuid = await extractStudentFromText(
    'Users a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 and b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22 have issues',
    'lib_123'
  );
  assert.equal(resUuid.student, null);
  assert.equal(resUuid.ambiguity, 'MULTIPLE_FOUND');
});

// 11. Real shared query helper for TicketMessage (preventing internal note leak)
test('11. Real shared query helper strictly enforces isInternalNote: false for non-admins (Real Code: getTicketMessageWhereClause)', () => {
  // Imported from src/lib/ticket-query-helpers.ts and used across both pages
  const librarianWhere = getTicketMessageWhereClause(false);
  assert.deepEqual(librarianWhere, { isInternalNote: false });

  const adminWhere = getTicketMessageWhereClause(true);
  assert.equal(adminWhere, undefined);
});

// 12. Real autoResolveTicket atomic lease claim (with mocked Prisma updateMany)
test('12. autoResolveTicket atomic lease claim: calls real autoResolveTicket with mocked updateMany returning count: 0 (Mocked Prisma + Real Resolver)', async () => {
  const originalEnv = process.env.TICKET_AUTO_RESOLVE_ENABLED;
  process.env.TICKET_AUTO_RESOLVE_ENABLED = 'true';
  resetFlagsMemoryCache();

  // Save original updateMany
  const originalUpdateMany = prisma.supportTicket.updateMany;

  // Stub updateMany to simulate an atomic lease query where botProcessedAt is already non-null (count: 0)
  prisma.supportTicket.updateMany = (async (args: any) => {
    assert.deepEqual(args.data.botAction, 'IN_PROGRESS');
    assert.ok(args.where.botProcessedAt === null);
    return { count: 0 }; // Already claimed by another concurrent worker
  }) as any;

  try {
    const result = await autoResolveTicket('mock-ticket-already-claimed');
    assert.equal(result.action, 'ALREADY_CLAIMED_OR_PROCESSED');
    assert.equal(result.resolved, false);
    assert.equal(result.status, 'OPEN');
    assert.equal(result.isInternalNote, true);
  } finally {
    prisma.supportTicket.updateMany = originalUpdateMany;
    if (originalEnv === undefined) {
      delete process.env.TICKET_AUTO_RESOLVE_ENABLED;
    } else {
      process.env.TICKET_AUTO_RESOLVE_ENABLED = originalEnv;
    }
    resetFlagsMemoryCache();
  }
});

// 13. Real addTicketMessageInternal execution: calls real service with mocked DB, asserting findFirst runs before create and applies escalation
test('13. addTicketMessageInternal real execution: calls internal service verifying findFirst executes before create (Real Service)', async () => {
  const callSequence: string[] = [];

  const originalFindUnique = prisma.supportTicket.findUnique;
  const originalFindFirst = prisma.ticketMessage.findFirst;
  const originalCreate = prisma.ticketMessage.create;
  const originalUpdate = prisma.supportTicket.update;

  let capturedUpdateData: any = null;

  // Mock Prisma ticket find
  prisma.supportTicket.findUnique = (async () => ({
    id: 'ticket_real_123',
    ticketNumber: 101,
    title: 'Scanner gate locked',
    description: 'Turnstile is not spinning',
    category: 'HARDWARE',
    priority: 'MEDIUM',
    status: 'BOT_REPLIED',
    autoResolved: false,
    botAction: 'DIAGNOSTIC_ADVICE_POSTED',
    creatorId: 'user_librarian_1',
    libraryId: 'lib_test_1',
    library: { id: 'lib_test_1', librarianId: 'user_librarian_1', name: 'Test Library' },
    creator: { id: 'user_librarian_1', name: 'Ramesh Librarian' },
  })) as any;

  // Mock findFirst prior public message
  prisma.ticketMessage.findFirst = (async () => {
    callSequence.push('ticketMessage.findFirst');
    return { senderRole: 'BOT' }; // Prior message was from BOT
  }) as any;

  // Mock message create
  prisma.ticketMessage.create = (async (args: any) => {
    callSequence.push('ticketMessage.create');
    return {
      id: 'msg_new_librarian_reply',
      ticketId: 'ticket_real_123',
      senderId: 'user_librarian_1',
      senderRole: 'LIBRARIAN',
      content: args.data.content,
      isInternalNote: args.data.isInternalNote,
      createdAt: new Date(),
    };
  }) as any;

  // Mock ticket update
  prisma.supportTicket.update = (async (args: any) => {
    callSequence.push('supportTicket.update');
    capturedUpdateData = args.data;
    return {};
  }) as any;

  const originalUserFindMany = prisma.user.findMany;
  const originalNotifCreate = prisma.notification.create;
  prisma.user.findMany = (async () => []) as any;
  prisma.notification.create = (async () => ({})) as any;

  try {
    const mockSession = {
      userId: 'user_librarian_1',
      role: 'LIBRARIAN' as const,
      phone: '9876543210',
      email: 'librarian@focusx.test',
      employerLibraryId: 'lib_test_1',
    };

    const result = await addTicketMessageInternal(
      'ticket_real_123',
      'The scanner gate is still stuck after trying step 1.',
      false,
      mockSession
    );

    assert.equal(result.success, true);
    // Crucial assertion: findFirst must execute BEFORE create!
    assert.deepEqual(callSequence, ['ticketMessage.findFirst', 'ticketMessage.create', 'supportTicket.update']);
    // Verify escalation fields passed to supportTicket.update
    assert.equal(capturedUpdateData.status, 'OPEN');
    assert.equal(capturedUpdateData.priority, 'HIGH');
    assert.ok(capturedUpdateData.escalatedAt instanceof Date);
    assert.equal(capturedUpdateData.autoResolved, false);
  } finally {
    prisma.supportTicket.findUnique = originalFindUnique;
    prisma.ticketMessage.findFirst = originalFindFirst;
    prisma.ticketMessage.create = originalCreate;
    prisma.supportTicket.update = originalUpdate;
    prisma.user.findMany = originalUserFindMany;
    prisma.notification.create = originalNotifCreate;
  }
});

// 14. Normal WAITING_ON_LIBRARIAN reply does not escalate ticket
test('14. Normal WAITING_ON_LIBRARIAN reply transitions to IN_PROGRESS without escalation (Real Code: computeReplyEscalation)', () => {
  const result = computeReplyEscalation({
    isAdmin: false,
    isInternalNote: false,
    ticket: {
      status: 'WAITING_ON_LIBRARIAN',
      priority: 'MEDIUM',
      category: 'OTHER',
      autoResolved: false,
      botAction: null,
      title: 'Need guidance on seat setup',
      description: 'How do I add lockers?',
      escalatedAt: null,
    },
    lastPublicMessageSenderRole: 'SUPPORT',
  });

  assert.equal(result.nextStatus, 'IN_PROGRESS');
  assert.equal(result.nextPriority, 'MEDIUM');
  assert.equal(result.nextEscalatedAt, null);
  assert.equal(result.shouldEscalate, false);
});

// 15. Reply after bot message escalates to OPEN with escalatedAt timestamp
test('15. Reply after bot message escalates to OPEN with escalatedAt timestamp (Real Code: computeReplyEscalation)', () => {
  const result = computeReplyEscalation({
    isAdmin: false,
    isInternalNote: false,
    ticket: {
      status: 'BOT_REPLIED',
      priority: 'LOW',
      category: 'OTHER',
      autoResolved: false,
      botAction: 'DIAGNOSTIC_ADVICE_POSTED',
      title: 'Turnstile gate issue',
      description: 'Gate is still not opening after power cycle',
      escalatedAt: null,
    },
    lastPublicMessageSenderRole: 'BOT',
  });

  assert.equal(result.nextStatus, 'OPEN');
  assert.equal(result.nextPriority, 'HIGH');
  assert.ok(result.nextEscalatedAt instanceof Date);
  assert.equal(result.shouldEscalate, true);
});

// 16. Reply on money-related ticket raises priority to URGENT
test('16. Reply after bot message on money-related ticket escalates priority to URGENT (Real Code: computeReplyEscalation)', () => {
  const result = computeReplyEscalation({
    isAdmin: false,
    isInternalNote: false,
    ticket: {
      status: 'RESOLVED',
      priority: 'LOW',
      category: 'BILLING_PAYOUTS',
      autoResolved: true,
      botAction: 'PAYMENT_CONFIRMED',
      title: 'paise kat gaye',
      description: 'Booking still showing pending',
      escalatedAt: null,
    },
    lastPublicMessageSenderRole: 'BOT',
  });

  assert.equal(result.nextStatus, 'OPEN');
  assert.equal(result.nextPriority, 'URGENT');
  assert.ok(result.nextEscalatedAt instanceof Date);
  assert.equal(result.shouldEscalate, true);
});

// 17. Priority is never lowered from existing URGENT to HIGH
test('17. Escalation priority is never lowered from existing URGENT to HIGH (Real Code: computeReplyEscalation)', () => {
  const result = computeReplyEscalation({
    isAdmin: false,
    isInternalNote: false,
    ticket: {
      status: 'BOT_REPLIED',
      priority: 'URGENT',
      category: 'OTHER',
      autoResolved: false,
      botAction: 'ADVICE_POSTED',
      title: 'Critical issue',
      description: 'Urgent attention required',
      escalatedAt: null,
    },
    lastPublicMessageSenderRole: 'BOT',
  });

  assert.equal(result.nextStatus, 'OPEN');
  assert.equal(result.nextPriority, 'URGENT', 'Priority must remain URGENT and never be lowered to HIGH');
  assert.ok(result.nextEscalatedAt instanceof Date);
  assert.equal(result.shouldEscalate, true);
});

// 18. Admin reply clears escalatedAt and moves status to WAITING_ON_LIBRARIAN
test('18. Admin reply clears escalatedAt and sets WAITING_ON_LIBRARIAN (Real Code: computeReplyEscalation)', () => {
  const result = computeReplyEscalation({
    isAdmin: true,
    isInternalNote: false,
    ticket: {
      status: 'OPEN',
      priority: 'HIGH',
      category: 'HARDWARE',
      autoResolved: false,
      botAction: null,
      title: 'Turnstile gate issue',
      description: 'Librarian escalated',
      escalatedAt: new Date(),
    },
  });

  assert.equal(result.nextStatus, 'WAITING_ON_LIBRARIAN');
  assert.equal(result.nextEscalatedAt, null, 'escalatedAt must be cleared on official admin reply');
  assert.equal(result.shouldEscalate, false);
});

// 19. Payment settlement delayed to bank is NOT classified as PAYMENT_PENDING
test('19. Payout settlement dispute in BILLING_PAYOUTS is NOT classified as PAYMENT_PENDING (Real Code: triageTicket)', async () => {
  const result = await triageTicket({
    title: 'payment settlement delayed to my bank',
    description: 'Weekly payout settlement from FocusX has not arrived in our bank account',
    category: 'BILLING_PAYOUTS',
    libraryId: 'lib_test_1',
  });

  // Must NOT trigger PAYMENT_PENDING (which is strictly for student booking confirmations)
  assert.equal(result.problemType, 'UNKNOWN');
  assert.ok(result.confidence < 0.6, `Confidence must be capped < 0.6, got ${result.confidence}`);
  assert.equal(result.detectedCategories.length, 0);
});

// 20. Student payment with razorpay booking pending and phone IS classified as PAYMENT_PENDING
test('20. Student payment with razorpay booking pending and phone IS classified as PAYMENT_PENDING (Real Code: triageTicket)', async () => {
  const originalUserFindMany = prisma.user.findMany;
  prisma.user.findMany = (async () => [
    { id: 'user_student_1', name: 'Aman Sharma', phone: '9876543210' },
  ]) as any;

  try {
    const result = await triageTicket({
      title: 'student payment deducted razorpay booking pending 9876543210',
      description: 'Student paid via razorpay and amount debited but booking status is pending',
      category: 'BILLING_PAYOUTS',
      libraryId: 'lib_test_1',
    });

    assert.equal(result.problemType, 'PAYMENT_PENDING');
    assert.ok(result.confidence >= 0.8, `Confidence must be >= 0.8, got ${result.confidence}`);
    assert.ok(result.matchedKeywords.length >= 1);
  } finally {
    prisma.user.findMany = originalUserFindMany;
  }
});
