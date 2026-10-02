# Actors and Capabilities

## 1. Student
- **Purpose**: End user who books library seats and physically visits locations.
- **Capabilities**: Browse libraries, perform KYC, book plans, generate QR access tokens.
- **Diagram**: ![Student Flow](diagrams/01-student-flow.mmd)
- **Status**: ACTIVE
- **Code location**: `src/app/(student)/`, `src/app/api/mobile/`

## 2. Librarian (Staff)
- **Purpose**: Library owner or manager who runs a specific library branch.
- **Capabilities**: Manage library details, configure seats and plans, process manual bookings, view live entry logs, handle refunds.
- **Diagram**: ![Librarian Flow](diagrams/02-librarian-flow.mmd)
- **Status**: ACTIVE
- **Code location**: `src/app/dashboard/`

## 3. Receptionist
- **Purpose**: Front-desk staff assigned to a specific library.
- **Capabilities**: Process manual/cash bookings, verify student identity, monitor live entry logs.
- **Diagram**: ![Receptionist Flow](diagrams/03-receptionist-flow.mmd)
- **Status**: ACTIVE
- **Code location**: `src/app/dashboard/` (Shares dashboard access based on specific role restrictions)

## 4. Admin
- **Purpose**: Global system administrator overseeing the platform.
- **Capabilities**: Approve library onboarding (KYC), global management, system stats.
- **Diagram**: ![Admin Flow](diagrams/04-admin-flow.mmd)
- **Status**: ACTIVE
- **Code location**: `src/app/admin/`
