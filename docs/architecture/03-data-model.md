# Data / Domain Model

## Important Entities
- **USER**: Stores students, librarians, receptionists, and admins based on the `Role` enum.
- **LIBRARY**: The physical space managed by a Librarian.
- **SEAT**: Physical seats or lockers within a library.
- **PLAN**: Pricing packages (Fixed or Flexible).
- **BOOKING_INTENT**: Tracks a booking in progress before payment completes (Holding state).
- **BOOKING**: A finalized, paid, or manual reservation of a Plan/Seat.
- **RELAY**: Hardware device configuration for access points.
- **ENTRY_LOG / CHECKIN_LOG**: Records physical check-ins.

## Diagram
![Domain Model](diagrams/09-domain-model.mmd)

## Status
- **Status**: ACTIVE
- **Evidence**: `prisma/schema.prisma` models, active backend routing.
- **Code location**: `prisma/schema.prisma`
- **Confidence**: High
