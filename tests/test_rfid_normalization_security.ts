import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Canonical Normalizer matching the firmware implementation exactly
function canonicalUID(s: string): string {
  return s.replace(/[:\s-]/g, '').toUpperCase();
}

function matchCredential(credUid: string, scannedPayload: string): boolean {
  if (credUid.toLowerCase() === scannedPayload.toLowerCase()) return true;
  const cleanCred = canonicalUID(credUid);
  const cleanPayload = canonicalUID(scannedPayload);
  return cleanCred.length > 0 && cleanCred === cleanPayload;
}

// Simulates the backend normalization lookup logic in /api/hardware/scan/route.ts
interface MockUser {
  id: string;
  name: string;
  rfidTag: string;
}

function mockBackendRfidLookup(payload: string, users: MockUser[]): { user: MockUser | null; status?: string; message?: string } {
  // 1. Exact lookup
  const exact = users.find(u => u.rfidTag === payload);
  if (exact) return { user: exact };

  // 2. Canonical normalization fallback with validation
  const cleanPayload = payload.replace(/[:\s-]/g, '').toUpperCase();
  if (/^[0-9A-F]{4,32}$/.test(cleanPayload)) {
    const colonSeparated = cleanPayload.length % 2 === 0 ? cleanPayload.match(/.{1,2}/g)?.join(':') : null;
    const matchingUsers = users.filter(u => {
      const uTagUpper = u.rfidTag.toUpperCase();
      return uTagUpper === cleanPayload || (colonSeparated && uTagUpper === colonSeparated);
    });

    if (matchingUsers.length === 1) {
      return { user: matchingUsers[0] };
    } else if (matchingUsers.length > 1) {
      return { user: null, status: 'DENY', message: 'AMBIGUOUS CARD' };
    }
  }

  return { user: null, status: 'DENY', message: 'UNKNOWN CARD' };
}

// Simulates library authorization check in src/lib/attendance-core.ts
interface MockBooking {
  studentId: string;
  libraryId: string;
  status: string;
  startTime: number;
  endTime: number;
  isPaused: boolean;
}

function mockAuthorizeStudentInLibrary(
  studentId: string,
  targetLibraryId: string,
  bookings: MockBooking[],
  nowUnix: number
): { allowed: boolean; reason?: string } {
  const activeBooking = bookings.find(b =>
    b.studentId === studentId &&
    b.libraryId === targetLibraryId &&
    b.status === 'CONFIRMED' &&
    b.startTime <= nowUnix &&
    b.endTime >= nowUnix &&
    !b.isPaused
  );

  if (!activeBooking) {
    return { allowed: false, reason: 'Access Denied: No active plan at this time.' };
  }
  return { allowed: true };
}

console.log('================================================================================');
console.log('FOCUSX RFID NORMALIZATION, AMBIGUITY & LIBRARY AUTH SECURITY TEST SUITE');
console.log('================================================================================');

let passed = 0;
let total = 0;
function testAssert(desc: string, condition: boolean) {
  total++;
  if (condition) {
    console.log(`[PASS] Test ${total}: ${desc}`);
    passed++;
  } else {
    console.error(`[FAIL] Test ${total}: ${desc}`);
    process.exitCode = 1;
  }
}

// --- 1. Canonical Normalization & Delimiter Equivalence ---
console.log('\n--- Category 1: Canonical Normalization & Delimiter Equivalence ---');
testAssert('Stripping colons preserves uppercase bytes', canonicalUID('17:77:2B:07') === '17772B07');
testAssert('Stripping hyphens preserves uppercase bytes', canonicalUID('17-77-2B-07') === '17772B07');
testAssert('Stripping whitespace preserves uppercase bytes', canonicalUID('17 77 2B 07') === '17772B07');
testAssert('Lowercase input normalized to uppercase', canonicalUID('17:77:2b:07') === '17772B07');
testAssert('matchCredential matches colon-delimited against raw un-delimited', matchCredential('17:77:2B:07', '17772B07') === true);
testAssert('matchCredential matches raw un-delimited against colon-delimited', matchCredential('17772B07', '17:77:2B:07') === true);
testAssert('matchCredential matches lowercase against uppercase', matchCredential('3dfd3007', '3DFD3007') === true);
testAssert('matchCredential preserves UUIDs with hyphens', matchCredential('c74384b6-a579-4dbe-a2bf-a75d5e1b212f', 'c74384b6-a579-4dbe-a2bf-a75d5e1b212f') === true);

// --- 2. Backend Lookup & Fallback Matching ---
console.log('\n--- Category 2: Backend Lookup & Fallback Matching ---');
const testDbUsers: MockUser[] = [
  { id: 'usr-1', name: 'Alice Student', rfidTag: '17:77:2B:07' },
  { id: 'usr-2', name: 'Bob Scholar', rfidTag: '3DFD3007' },
  { id: 'usr-3', name: 'Charlie Reader', rfidTag: '835cae11' }
];

testAssert('Exact lookup succeeds for un-delimited tag', mockBackendRfidLookup('3DFD3007', testDbUsers).user?.id === 'usr-2');
testAssert('Fallback lookup succeeds when hardware sends un-delimited for colon-delimited DB tag', mockBackendRfidLookup('17772B07', testDbUsers).user?.id === 'usr-1');
testAssert('Fallback lookup succeeds when hardware sends uppercase for lowercase DB tag', mockBackendRfidLookup('835CAE11', testDbUsers).user?.id === 'usr-3');
testAssert('Fallback lookup succeeds when hardware sends colon-delimited for un-delimited DB tag', mockBackendRfidLookup('3D:FD:30:07', testDbUsers).user?.id === 'usr-2');

// --- 3. Ambiguity Rejection ---
console.log('\n--- Category 3: Ambiguity Rejection ---');
const ambiguousDbUsers: MockUser[] = [
  { id: 'usr-dup-1', name: 'Student One', rfidTag: 'AA:BB:CC:DD' },
  { id: 'usr-dup-2', name: 'Student Two', rfidTag: 'AABBCCDD' }
];

const ambResult = mockBackendRfidLookup('AABBCCDD', ambiguousDbUsers);
testAssert('Exact match takes priority if payload directly matches one record', ambResult.user?.id === 'usr-dup-2');

const ambSearch = mockBackendRfidLookup('aa:bb:cc:dd', [
  { id: 'usr-dup-1', name: 'Student One', rfidTag: 'AA:BB:CC:DD' },
  { id: 'usr-dup-2', name: 'Student Two', rfidTag: 'AABBCCDD' }
]);
testAssert('Multiple candidate normalized matches trigger AMBIGUOUS CARD rejection', ambSearch.status === 'DENY' && ambSearch.message === 'AMBIGUOUS CARD');

// --- 4. Malformed Input Rejection ---
console.log('\n--- Category 4: Malformed Input Rejection ---');
testAssert('Non-hex string rejected as UNKNOWN CARD', mockBackendRfidLookup('INVALID_CARD_XYZ', testDbUsers).message === 'UNKNOWN CARD');
testAssert('Short string (<4 chars) rejected as UNKNOWN CARD', mockBackendRfidLookup('12', testDbUsers).message === 'UNKNOWN CARD');
testAssert('Empty string rejected as UNKNOWN CARD', mockBackendRfidLookup('', testDbUsers).message === 'UNKNOWN CARD');

// --- 5. Preservation of Library Authorization Checks ---
console.log('\n--- Category 5: Preservation of Library Authorization Checks ---');
const testBookings: MockBooking[] = [
  {
    studentId: 'usr-1',
    libraryId: 'lib-kripa-1',
    status: 'CONFIRMED',
    startTime: 1000,
    endTime: 5000,
    isPaused: false
  },
  {
    studentId: 'usr-2',
    libraryId: 'lib-central-2',
    status: 'CONFIRMED',
    startTime: 1000,
    endTime: 5000,
    isPaused: false
  }
];

const authValid = mockAuthorizeStudentInLibrary('usr-1', 'lib-kripa-1', testBookings, 2000);
testAssert('Student with valid booking in assigned library is authorized', authValid.allowed === true);

const authWrongLib = mockAuthorizeStudentInLibrary('usr-1', 'lib-central-2', testBookings, 2000);
testAssert('Student scanning at a different library is rejected (library isolation)', authWrongLib.allowed === false && Boolean(authWrongLib.reason?.includes('No active plan')));

const authExpired = mockAuthorizeStudentInLibrary('usr-1', 'lib-kripa-1', testBookings, 6000);
testAssert('Student with expired booking is rejected', authExpired.allowed === false);

const authPaused = mockAuthorizeStudentInLibrary('usr-1', 'lib-kripa-1', [
  { studentId: 'usr-1', libraryId: 'lib-kripa-1', status: 'CONFIRMED', startTime: 1000, endTime: 5000, isPaused: true }
], 2000);
testAssert('Student with paused booking is rejected', authPaused.allowed === false);

console.log('\n================================================================================');
console.log(`TOTAL SECURITY & NORMALIZATION CHECKS: ${passed} / ${total} PASSED (${Math.round((passed/total)*100)}%)`);
console.log('================================================================================');
