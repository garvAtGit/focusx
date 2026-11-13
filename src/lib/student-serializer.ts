// src/lib/student-serializer.ts
// Explicit role-scoped DTO serializers and library boundary verifiers.

export interface LibrarianStudentBasicDTO {
  id: string;
  uniqueId: string | null;
  username: string;
  displayName: string;
  legalName: string;
  isKycVerified: boolean;
  kycStatus: string;
  phone: string | null;
  address: string | null;
  guardianName: string | null;
  guardianContactNumber: string | null;
  profilePhotoUrl: string | null;
  hasExtraAccess: boolean;
  extraAccessExpiresAt: Date | null;
  extraFields?: {
    email?: string | null;
    dob?: Date | string | null;
    gender?: string | null;
    qualification?: string | null;
    organization?: string | null;
    locality?: string | null;
  };
}

export interface CommunityStudentDTO {
  username: string;
  displayName: string;
  avatar: string | null;
}

export interface RawStudentEntity {
  id: string;
  name: string;
  displayName?: string | null;
  legalName?: string | null;
  username: string;
  uniqueId?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  dob?: Date | string | null;
  gender?: string | null;
  qualification?: string | null;
  organization?: string | null;
  locality?: string | null;
  profilePhotoUrl?: string | null;
  digilockerVerified?: boolean;
  kycStatus?: string | null;
  guardianName?: string | null;
  guardianContactNumber?: string | null;
  password?: string | null;
  authId?: string | null;
  [key: string]: unknown;
}

export interface ActiveExtraAccessGrant {
  approved: boolean;
  expiresAt: Date | null;
  allowedFields: string[];
}

/**
 * Serializes a student profile for a librarian under strict role-allowlist rules.
 * Basic info is always permitted for enrolled students:
 * legalName (with unverified flag if KYC not complete), phone, address, KYC status, guardian.
 * Sensitive extra fields (email, dob, qualification, etc.) are ONLY exposed if an approved,
 * unexpired StudentInfoRequest grant exists.
 */
export function serializeStudentForLibrarian(
  student: RawStudentEntity,
  grant?: ActiveExtraAccessGrant | null
): LibrarianStudentBasicDTO {
  const isKycVerified = student.kycStatus === 'VERIFIED' || Boolean(student.digilockerVerified);
  const legalName = student.legalName || student.name || 'Unverified Student';
  const displayName = student.displayName || student.name || 'Student';

  const dto: LibrarianStudentBasicDTO = {
    id: student.id,
    uniqueId: student.uniqueId || null,
    username: student.username,
    displayName,
    legalName,
    isKycVerified,
    kycStatus: student.kycStatus || (student.digilockerVerified ? 'VERIFIED' : 'NOT_STARTED'),
    phone: student.phone || null,
    address: student.address || null,
    guardianName: student.guardianName || null,
    guardianContactNumber: student.guardianContactNumber || null,
    profilePhotoUrl: student.profilePhotoUrl || null,
    hasExtraAccess: false,
    extraAccessExpiresAt: null,
  };

  // Check if active, unexpired grant exists
  if (grant?.approved && grant.expiresAt && grant.expiresAt.getTime() > Date.now()) {
    dto.hasExtraAccess = true;
    dto.extraAccessExpiresAt = grant.expiresAt;
    dto.extraFields = {};

    const fields = new Set(grant.allowedFields.map((f) => f.toLowerCase()));

    if (fields.has('email')) dto.extraFields.email = student.email || null;
    if (fields.has('dob')) dto.extraFields.dob = student.dob || null;
    if (fields.has('gender')) dto.extraFields.gender = student.gender || null;
    if (fields.has('qualification')) dto.extraFields.qualification = student.qualification || null;
    if (fields.has('organization')) dto.extraFields.organization = student.organization || null;
    if (fields.has('locality')) dto.extraFields.locality = student.locality || null;
  }

  return dto;
}

/**
 * Serializes a student for public/community views (Leaderboard, winter-arc, etc.).
 * Guarantees zero PII leakage: never includes legalName, phone, email, address, guardian, or DOB.
 */
export function serializeStudentForCommunity(student: RawStudentEntity): CommunityStudentDTO {
  return {
    username: student.username,
    displayName: student.displayName || (student.name ? student.name.split(' ')[0] : 'Student'),
    avatar: student.profilePhotoUrl || null,
  };
}

