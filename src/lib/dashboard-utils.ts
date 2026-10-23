import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import type { SessionData } from '@/app/actions/auth-actions';

/**
 * Resolves the active library for the dashboard context based on the user's role.
 * 
 * - LIBRARIAN: Returns their owned library.
 * - RECEPTIONIST: Returns their employed library.
 * - ADMIN: Checks the `admin_active_library_id` cookie to fetch a selected library.
 *          Defaults to the first library in the DB if none selected.
 */
export async function getActiveLibrary(session: SessionData) {
  const cookieStore = await cookies();

  if (session.role === 'ADMIN') {
    const adminLibId = cookieStore.get('admin_active_library_id')?.value;
    if (adminLibId) {
      const lib = await prisma.library.findUnique({ where: { id: adminLibId } });
      if (lib) return lib;
    }
    // Fallback to first library if no cookie or invalid cookie
    return await prisma.library.findFirst({});
  } else if (session.role === 'RECEPTIONIST') {
    // Check staff_active_library_id cookie
    const staffLibId = cookieStore.get('staff_active_library_id')?.value;
    if (staffLibId) {
      // Verify active membership or legacy employment
      const membership = await prisma.libraryStaff.findFirst({
        where: { userId: session.userId, libraryId: staffLibId, status: 'ACTIVE' },
        include: { library: true },
      });
      if (membership?.library) return membership.library;

      if (session.employerLibraryId === staffLibId) {
        const lib = await prisma.library.findUnique({ where: { id: staffLibId } });
        if (lib) return lib;
      }
    }

    // Check first active staff membership
    const activeMembership = await prisma.libraryStaff.findFirst({
      where: { userId: session.userId, status: 'ACTIVE' },
      include: { library: true },
      orderBy: { createdAt: 'asc' },
    });
    if (activeMembership?.library) return activeMembership.library;

    // Legacy fallback
    if (session.employerLibraryId) {
      return await prisma.library.findUnique({ where: { id: session.employerLibraryId } });
    }
    return null;
  } else {
    // LIBRARIAN (Owner)
    const ownerLibId = cookieStore.get('librarian_active_library_id')?.value;
    if (ownerLibId) {
      const lib = await prisma.library.findFirst({
        where: { id: ownerLibId, librarianId: session.userId },
      });
      if (lib) return lib;
    }
    return await prisma.library.findFirst({ where: { librarianId: session.userId } });
  }
}
