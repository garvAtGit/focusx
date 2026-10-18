# Permissions

| Capability | Student | Librarian | Receptionist | Admin |
|------------|---------|-----------|--------------|-------|
| Own Profile / KYC | ✓ | — | — | (Read Only) |
| Book Online | ✓ | — | — | — |
| Process Manual Bookings | — | ✓ | ✓ | ✓ |
| Manage Library Details | — | ✓ (Own) | — | ✓ (All) |
| View Entry Logs | — | ✓ (Own) | ✓ (Own) | ✓ (All) |
| Manage Staff | — | ✓ (Own) | — | ✓ (All) |
| Approve Library KYC | — | — | — | ✓ |

## Status
- **Status**: ACTIVE
- **Evidence**: Derived from the `Role` enum in schema and route grouping structures (`/admin`, `/dashboard`, `/(student)`).
- **Code location**: `prisma/schema.prisma`, `src/app/`
- **Confidence**: High
