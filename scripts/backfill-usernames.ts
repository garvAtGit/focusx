import prisma from '../src/lib/prisma';
import { validateUsername } from '../src/lib/username-validator';

export function deriveHandleFromName(name: string): string {
  if (!name || typeof name !== 'string') return 'student';

  // 1. ASCII-fold (decomposes accents, replaces non-ascii)
  const normalized = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toLowerCase()
    .trim();

  // 2. Replace spaces & non-alphanumeric (except . and _) with _
  let handle = normalized
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9._]/g, '')
    .replace(/^_+|_+$/g, '')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/_{2,}/g, '_');

  // 3. Truncate if too long (leave room for suffix)
  if (handle.length > 22) {
    handle = handle.substring(0, 22).replace(/[._]+$/, '');
  }

  // 4. Validate through the shared rules
  const check = validateUsername(handle);
  if (!check.valid) {
    return 'student';
  }

  return check.normalized;
}

export async function runBackfill() {
  console.log('Fetching users needing username backfill...');
  const users = await prisma.user.findMany({
    where: { username: null as any },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${users.length} users with missing username.`);
  if (users.length === 0) {
    console.log('No users to backfill.');
    return;
  }

  // Collect existing taken usernames to guarantee in-memory fast collision resolution
  const existingUsers = await prisma.user.findMany({
    where: { username: { not: null as any } },
    select: { username: true },
  });
  const taken = new Set<string>(existingUsers.map((u) => u.username as string));

  let count = 0;
  for (const user of users) {
    const base = deriveHandleFromName(user.name);
    let candidate = base;
    let suffix = 1;

    // Resolve collisions
    while (taken.has(candidate) || !validateUsername(candidate).valid) {
      const suffixStr = `_${suffix}`;
      const prefix = base.substring(0, Math.min(base.length, 30 - suffixStr.length));
      candidate = `${prefix}${suffixStr}`;
      suffix++;
    }

    taken.add(candidate);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        username: candidate,
        usernameConfirmed: false,
        displayName: user.name,
      },
    });

    count++;
    if (count % 100 === 0 || count === users.length) {
      console.log(`Backfilled ${count}/${users.length} users...`);
    }
  }

  console.log(`Successfully backfilled all ${count} users!`);
}

// Allow direct CLI invocation
if (process.argv[1]?.includes('backfill-usernames')) {
  runBackfill()
    .catch((err) => {
      console.error('Backfill failed:', err);
      process.exit(1);
    })
    .finally(() => process.exit(0));
}
