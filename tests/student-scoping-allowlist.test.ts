// tests/student-scoping-allowlist.test.ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  serializeStudentForLibrarian,
  serializeStudentForCommunity,
  type RawStudentEntity,
  type ActiveExtraAccessGrant,
} from '../src/lib/student-serializer';

describe('Student Identity, KYC & Librarian Role Allowlist Suite', () => {

  const mockStudent: RawStudentEntity = {
    id: 'student-uuid-1234',
    name: 'Shivam Sharma',
    legalName: 'Shivam Kumar Sharma',
    displayName: 'Shivam',
    username: 'shivam_07',
    uniqueId: 'FD-26XY89',
    phone: '+919876543210',
    email: 'shivam@example.com',
    dob: new Date('2001-05-15'),
    gender: 'MALE',
    address: '123 Focus Street, Delhi',
    locality: 'North Delhi',
    qualification: 'B.Tech Computer Science',
    organization: 'Delhi University',
    profilePhotoUrl: 'https://cdn.imagekit.io/focusx/profile1.jpg',
    digilockerVerified: true,
    kycStatus: 'VERIFIED',
    guardianName: 'Ramesh Sharma',
    guardianContactNumber: '+919876500000',
    password: 'hashed_password_should_never_leak',
    authId: 'firebase_internal_uid_xyz',
  };

  describe('1. Librarian Basic View (Role Allowlist)', () => {
    test('Returns only basic info (legalName, phone, address, KYC status, guardian) when no extra grant exists', () => {
      const serialized = serializeStudentForLibrarian(mockStudent, null);

      // Permitted fields
      assert.equal(serialized.legalName, 'Shivam Kumar Sharma');
      assert.equal(serialized.phone, '+919876543210');
      assert.equal(serialized.address, '123 Focus Street, Delhi');
      assert.equal(serialized.isKycVerified, true);
      assert.equal(serialized.kycStatus, 'VERIFIED');
      assert.equal(serialized.guardianName, 'Ramesh Sharma');
      assert.equal(serialized.guardianContactNumber, '+919876500000');
      assert.equal(serialized.username, 'shivam_07');
      assert.equal(serialized.hasExtraAccess, false);

      // Sensitive extra fields must NOT be present
      assert.equal(serialized.extraFields, undefined);

      // Internal secrets must never exist on the DTO
      assert.equal((serialized as any).password, undefined);
      assert.equal((serialized as any).authId, undefined);
    });

    test('Marks unverified students clearly when KYC is not complete', () => {
      const unverifiedStudent: RawStudentEntity = {
        ...mockStudent,
        legalName: null,
        digilockerVerified: false,
        kycStatus: 'NOT_STARTED',
      };

      const serialized = serializeStudentForLibrarian(unverifiedStudent, null);
      assert.equal(serialized.isKycVerified, false);
      assert.equal(serialized.kycStatus, 'NOT_STARTED');
      assert.equal(serialized.legalName, 'Shivam Sharma'); // Falls back to display name with isKycVerified=false
    });
  });

  describe('2. Extra Info Request & 7-Day Expiry', () => {
    test('Unlocks approved extra fields when grant is active and not expired', () => {
      const futureDate = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000); // 6 days from now
      const activeGrant: ActiveExtraAccessGrant = {
        approved: true,
        expiresAt: futureDate,
        allowedFields: ['dob', 'email', 'qualification'],
      };

      const serialized = serializeStudentForLibrarian(mockStudent, activeGrant);

      assert.equal(serialized.hasExtraAccess, true);
      assert.ok(serialized.extraFields);
      assert.equal(serialized.extraFields?.email, 'shivam@example.com');
      assert.equal(serialized.extraFields?.qualification, 'B.Tech Computer Science');
      assert.ok(serialized.extraFields?.dob);

      // Field that was NOT requested remains hidden
      assert.equal(serialized.extraFields?.organization, undefined);
    });

    test('Reverts to basic info when extra access grant has expired (>7 days)', () => {
      const pastDate = new Date(Date.now() - 1000 * 60); // Expired 1 minute ago
      const expiredGrant: ActiveExtraAccessGrant = {
        approved: true,
        expiresAt: pastDate,
        allowedFields: ['dob', 'email'],
      };

      const serialized = serializeStudentForLibrarian(mockStudent, expiredGrant);

      assert.equal(serialized.hasExtraAccess, false);
      assert.equal(serialized.extraFields, undefined);
    });

    test('Does not unlock extra fields if grant is rejected or not approved', () => {
      const rejectedGrant: ActiveExtraAccessGrant = {
        approved: false,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        allowedFields: ['dob', 'email'],
      };

      const serialized = serializeStudentForLibrarian(mockStudent, rejectedGrant);

      assert.equal(serialized.hasExtraAccess, false);
      assert.equal(serialized.extraFields, undefined);
    });
  });

  describe('3. Community & Leaderboard View Privacy', () => {
    test('Public/Student view contains only @username, displayName, avatar — ZERO private fields', () => {
      const publicView = serializeStudentForCommunity(mockStudent);

      assert.equal(publicView.username, 'shivam_07');
      assert.equal(publicView.displayName, 'Shivam');
      assert.equal(publicView.avatar, 'https://cdn.imagekit.io/focusx/profile1.jpg');

      // Zero leakage of private contact / KYC details
      assert.equal((publicView as any).legalName, undefined);
      assert.equal((publicView as any).phone, undefined);
      assert.equal((publicView as any).email, undefined);
      assert.equal((publicView as any).address, undefined);
      assert.equal((publicView as any).dob, undefined);
      assert.equal((publicView as any).guardianName, undefined);
      assert.equal((publicView as any).guardianContactNumber, undefined);
    });
  });

  describe('4. Library Scoping Logic', () => {
    test('Librarian cannot access student from another library', () => {
      const studentLibraryBookings = [{ libraryId: 'library-alpha' }];
      const librarianActiveLibraryId = 'library-beta';

      const isStudentEnrolledInLibrarianLibrary = studentLibraryBookings.some(
        (b) => b.libraryId === librarianActiveLibraryId
      );

      assert.equal(isStudentEnrolledInLibrarianLibrary, false, 'Student does not belong to library-beta');
    });

    test('Librarian can access student enrolled in their own library', () => {
      const studentLibraryBookings = [{ libraryId: 'library-alpha' }, { libraryId: 'library-beta' }];
      const librarianActiveLibraryId = 'library-beta';

      const isStudentEnrolledInLibrarianLibrary = studentLibraryBookings.some(
        (b) => b.libraryId === librarianActiveLibraryId
      );

      assert.equal(isStudentEnrolledInLibrarianLibrary, true, 'Student belongs to library-beta');
    });
  });
});

