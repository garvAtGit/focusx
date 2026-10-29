# Glossary

This document translates technical terminology found in the FocusDesk codebase into plain library management terms.

| Technical / Code Term | Plain Library Term | Definition |
|-----------------------|--------------------|------------|
| **User (Role: STUDENT)** | **Patron** | A person who uses the library, books seats, and scans in/out. |
| **User (Role: LIBRARIAN)** | **Library Owner/Manager** | The administrator who oversees a specific library's operations, plans, and financials. |
| **User (Role: RECEPTIONIST)**| **Front Desk Staff** | An employee assigned to a library to handle daily operations like manual checkout approval. |
| **BookingIntent** | **Checkout Cart / Hold** | A temporary 20-minute reservation placed when a patron attempts to buy a plan. Ensures two people can't buy the same seat simultaneously. |
| **Booking** | **Subscription / Reservation** | A confirmed, paid record granting a patron access to the library for a specific period (e.g., 30 days). |
| **Plan** | **Membership Package** | A predefined offering (e.g., "12 Hours Daily - Fixed") created by the librarian that dictates access rules and price. |
| **EntryLog / CheckinLog** | **Attendance Record** | A timestamped log created every time a patron scans their QR code or RFID tag at the door. |
| **Relay / ESP32** | **Physical Scanner / Turnstile** | The custom-built hardware device mounted at the library entrance that reads QR codes or RFID cards. |
| **Supabase / WebSockets** | **Live Updates** | The technology that allows the librarian's dashboard screen to instantly update when a patron walks through the door, without refreshing the page. |
| **Prisma / PostgreSQL** | **Database** | The secure, digital filing cabinet where all patrons, plans, and attendance records are permanently stored. |
| **Razorpay / Cashfree** | **Payment Gateway** | Third-party companies that handle the secure processing of credit cards and UPI transactions. |
| **Rules Engine** | **Automated Workflows** | Background system logic that automatically warns patrons if they overstay their booked hours, or revokes their access if they owe money. |
| **Winter Arc** | **Study Challenge** | A gamified campaign where patrons pledge to study a certain number of hours, competing on a public leaderboard. |
