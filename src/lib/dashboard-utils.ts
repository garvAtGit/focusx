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
  if (session.role === 'ADMIN') {
    const cookieStore = await cookies();
    const adminLibId = cookieStore.get('admin_active_library_id')?.value;
    if (adminLibId) {
      const lib = await prisma.library.findUnique({ where: { id: adminLibId } });
      if (lib) return lib;
    }
    // Fallback to first library if no cookie or invalid cookie
    return await prisma.library.findFirst({});
  } else if (session.role === 'RECEPTIONIST') {
    return await prisma.library.findUnique({ where: { id: session.employerLibraryId as string } });
  } else {
    // LIBRARIAN
    return await prisma.library.findFirst({ where: { librarianId: session.userId } });
  }
}
