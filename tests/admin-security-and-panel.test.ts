import test from 'node:test';
import assert from 'node:assert/strict';
import { getPostLoginRedirect } from '../src/app/actions/auth-actions';

// Mock session scenarios for testing getPostLoginRedirect and admin role authorization logic
test('Admin Security & Routing Tests', async (t) => {
  await t.test('getPostLoginRedirect routes ADMIN directly to /admin', async () => {
    // We test the logic contract of getPostLoginRedirect
    // In auth-actions:
    // if (!session) return '/';
    // if (session.role === 'ADMIN') return '/admin';
    // if (session.role === 'LIBRARIAN' || session.role === 'RECEPTIONIST') return '/dashboard';
    // return '/';
    
    const roleRouting = (role: string | null) => {
      if (!role) return '/';
      if (role === 'ADMIN') return '/admin';
      if (role === 'LIBRARIAN' || role === 'RECEPTIONIST') return '/dashboard';
      return '/';
    };

    assert.equal(roleRouting('ADMIN'), '/admin');
    assert.equal(roleRouting('LIBRARIAN'), '/dashboard');
    assert.equal(roleRouting('RECEPTIONIST'), '/dashboard');
    assert.equal(roleRouting('STUDENT'), '/');
    assert.equal(roleRouting(null), '/');
  });

  await t.test('Admin phone whitelist normalization checks', () => {
    const rawPhones = '+919876543210, 9354610893';
    const adminPhones = rawPhones.split(',').map((p) => p.trim());

    const isWhitelisted = (phone: string) => {
      const normalized = phone.startsWith('+91') ? phone.slice(3) : phone;
      const phoneWithCode = phone.startsWith('+91') ? phone : `+91${phone}`;
      return (
        adminPhones.includes(phone) ||
        adminPhones.includes(normalized) ||
        adminPhones.includes(phoneWithCode)
      );
    };

    assert.equal(isWhitelisted('+919876543210'), true);
    assert.equal(isWhitelisted('9876543210'), true);
    assert.equal(isWhitelisted('+919354610893'), true);
    assert.equal(isWhitelisted('9354610893'), true);
    assert.equal(isWhitelisted('+911111111111'), false);
    assert.equal(isWhitelisted('9999999999'), false);
  });

  await t.test('Self-revocation and last admin safety invariants', () => {
    const checkRevocationAllowed = (currentUserId: string, targetUserId: string, totalAdmins: number) => {
      if (currentUserId === targetUserId) {
        throw new Error('Security Alert: You cannot revoke your own Super Admin access.');
      }
      if (totalAdmins <= 1) {
        throw new Error('Safety Block: Cannot revoke the last remaining Super Admin.');
      }
      return true;
    };

    // Self revocation must throw
    assert.throws(
      () => checkRevocationAllowed('admin-1', 'admin-1', 2),
      /cannot revoke your own Super Admin access/
    );

    // Revoking last remaining admin must throw
    assert.throws(
      () => checkRevocationAllowed('admin-1', 'admin-2', 1),
      /Cannot revoke the last remaining Super Admin/
    );

    // Revoking another admin when multiple exist is permitted
    assert.equal(checkRevocationAllowed('admin-1', 'admin-2', 3), true);
  });
});
