# Architecture Summary

This document describes the current production architecture of the **Library Near** platform, reverse-engineered directly from repository evidence. 

The system is a unified monolith built on **Next.js (App Router)** serving as both the web frontend and the backend API. It supports multiple actors (Students, Librarians, Receptionists, Admins) through distinct web portal sections (`/student`, `/dashboard`, `/admin`) and provides a REST API (`/api/mobile/*`) for a separate mobile application. 

The primary data store is **PostgreSQL**, accessed via **Prisma ORM**. The system relies heavily on third-party services: **Firebase** for core authentication, **Razorpay** for payment processing, **Cashfree** for KYC verification, **ImageKit** for image hosting, and **Sanity** for CMS (Blog). Additionally, the system interfaces with custom ESP32/NodeMCU hardware ("Relays") for physical access control (QR/NFC check-ins) and utilizes **Supabase** for real-time websocket streaming (e.g., live entry logs).

---

# 1. System Overview

```mermaid
flowchart TD
    %% Actors
    StudentWeb[Student \nWeb App]
    StudentMobile[Student \nMobile App]
    Librarian[Librarian / Staff \nWeb Dashboard]
    Admin[Admin \nWeb Dashboard]
    Hardware[ESP32/NodeMCU \nHardware Relay]

    %% Main Next.js Monolith
    subgraph Monolith [Next.js Application]
        UI_Student[Student Portal \n/app/student]
        UI_Dashboard[Staff Dashboard \n/app/dashboard]
        UI_Admin[Admin Portal \n/app/admin]
        
        API_Mobile[Mobile APIs \n/api/mobile]
        API_Hardware[Hardware APIs \n/api/hardware & relay]
        API_Webhooks[Webhooks \n/api/webhooks]
        
        CoreLogic[Business Logic & \nBooking Engine]
    end

    %% Infrastructure & Data
    Database[(PostgreSQL \nvia Prisma)]
    Redis[(Upstash Redis \nRate Limiting)]
    
    %% External Services
    Firebase[Firebase \nAuth]
    Razorpay[Razorpay \nPayments]
    Cashfree[Cashfree \nKYC]
    ImageKit[ImageKit \nImage Storage]
    Sanity[Sanity CMS \nBlog]
    Supabase[Supabase \nRealtime WebSockets]

    %% Connections
    StudentWeb -->|Next.js Server Actions| UI_Student
    Librarian -->|Next.js Server Actions| UI_Dashboard
    Admin -->|Next.js Server Actions| UI_Admin
    StudentMobile -->|REST| API_Mobile
    Hardware -->|REST| API_Hardware
    
    UI_Student --> CoreLogic
    UI_Dashboard --> CoreLogic
    UI_Admin --> CoreLogic
    API_Mobile --> CoreLogic
    
    CoreLogic --> Database
    CoreLogic --> Redis
    
    %% External Integrations
    UI_Student -.->|Auth| Firebase
    UI_Dashboard -.->|Auth| Firebase
    StudentMobile -.->|Auth| Firebase
    
    CoreLogic -->|Create Order| Razorpay
    Razorpay -->|Payment Webhook| API_Webhooks
    API_Webhooks --> CoreLogic
    
    CoreLogic -->|Verify KYC| Cashfree
    CoreLogic -->|Content| Sanity
    
    UI_Student -.->|Upload/View| ImageKit
    UI_Dashboard -.->|Upload/View| ImageKit
    
    Database -.->|Listen to changes| Supabase
    Supabase -.->|Live Entry Logs| UI_Dashboard
```

---

# 2. Role / Capability Flows

```mermaid
flowchart LR
    %% Roles
    Student([Student])
    Librarian([Librarian])
    Receptionist([Receptionist])
    Admin([Admin])

    %% Capabilities
    subgraph StudentCapabilities [Student Capabilities]
        S1[Browse Libraries]
        S2[Complete KYC]
        S3[Book Plan & Seat]
        S4[Generate Access QR]
        S5[Submit Feedback/Queries]
    end

    subgraph StaffCapabilities [Staff Capabilities - Dashboard]
        L1[Manage Seats & Plans]
        L2[View Financials & Approvals]
        L3[Process Manual Bookings]
        L4[Manage Staff/Receptionists]
        L5[View Live Entry Logs]
    end
    
    subgraph ReceptionistCapabilities [Receptionist Capabilities]
        R1[Process Manual Bookings]
        R2[View Active Students]
        R3[Handle Queries/Inquiries]
    end

    subgraph AdminCapabilities [Global Admin]
        A1[Manage All Libraries]
        A2[Global System Config]
    end

    %% Mappings
    Student --> S1 & S2 & S3 & S4 & S5
    Librarian --> L1 & L2 & L3 & L4 & L5
    Receptionist --> R1 & R2 & R3
    Admin --> A1 & A2
```

---

# 3. Core Business Workflows

### A. Booking & Payment (Two-Phase Commit)
```mermaid
sequenceDiagram
    actor Student
    participant UI as Frontend
    participant API as Next.js API/Actions
    participant DB as PostgreSQL
    participant RZP as Razorpay

    Student->>UI: Select Plan & Seat
    UI->>API: Initialize Booking
    API->>DB: Create BookingIntent (Status: HOLDING)
    API->>DB: Create ResourceLease (Lock seat temporary)
    API->>RZP: Create Razorpay Order
    RZP-->>API: order_id
    API-->>UI: Return order_id
    Student->>UI: Pay via Razorpay Checkout
    UI->>RZP: Complete Payment
    RZP-->>Student: Success
    
    note over API,RZP: Asynchronous Webhook
    RZP->>API: Webhook (payment.captured)
    API->>DB: Validate payment signature
    API->>DB: Update BookingIntent (Status: CONFIRMED)
    API->>DB: Create permanent Booking record
```

### B. Hardware Access & Check-In
```mermaid
sequenceDiagram
    actor Student
    participant Mobile as Mobile App / Web
    participant Relay as ESP32 Hardware Relay
    participant API as Next.js API (/api/hardware)
    participant DB as PostgreSQL
    participant Supabase as Supabase Realtime
    participant Staff as Staff Dashboard

    Student->>Mobile: Open Access QR
    Mobile->>Relay: Scan QR Code (or NFC)
    Relay->>API: POST /api/hardware/log (send QR token/NFC ID)
    API->>DB: Validate User Booking & Access Rules
    API->>DB: Create EntryLog & CheckinLog
    API-->>Relay: Success (Unlock Door)
    
    note over DB,Supabase: Realtime Sync
    DB-->>Supabase: Postgres trigger/event
    Supabase-->>Staff: WebSocket push (LiveEntryLogs)
    Staff->>Staff: Display student entry in UI
```

---

# 4. Data / Domain Model

```mermaid
erDiagram
    USER {
        string id PK
        string role "STUDENT, LIBRARIAN, ADMIN, RECEPTIONIST"
        string phone
        string email
        string kycAadhaarStatus
        int walletBalance
    }
    LIBRARY {
        string id PK
        string librarianId FK
        string name
        string kycStatus
        boolean compactSeatMap
    }
    SEAT {
        string id PK
        string libraryId FK
        string name
        string type "RESERVED, NORMAL, PREMIUM"
        boolean hasLocker
    }
    PLAN {
        string id PK
        string libraryId FK
        string name
        string type "FIXED, FLEXIBLE"
        float price
    }
    BOOKING_INTENT {
        string id PK
        string studentId FK
        string libraryId FK
        string status "HOLDING, CONFIRMED, CANCELLED"
        string providerPaymentId
    }
    BOOKING {
        string id PK
        string studentId FK
        string libraryId FK
        string planId FK
        string seatId FK
        string status "PENDING_PAYMENT, CONFIRMED, CANCELLED"
        dateTime startTime
        dateTime endTime
    }
    ENTRY_LOG {
        string id PK
        string userId FK
        string libraryId FK
        dateTime timestamp
        string status
    }
    RELAY {
        string id PK
        string libraryId FK
        string nfcTagId
        string status
    }

    USER ||--o{ LIBRARY : "Manages (Librarian)"
    USER ||--o{ BOOKING : "Makes"
    LIBRARY ||--o{ SEAT : "Has"
    LIBRARY ||--o{ PLAN : "Offers"
    LIBRARY ||--o{ RELAY : "Installs"
    SEAT ||--o{ BOOKING : "Allocated to"
    PLAN ||--o{ BOOKING : "Defines rules for"
    BOOKING_INTENT ||--o| BOOKING : "Results in"
    USER ||--o{ ENTRY_LOG : "Generates"
```

---

# 5. Permissions / Responsibilities

| Capability / Entity | Student | Receptionist | Librarian | Admin |
|---------------------|---------|--------------|-----------|-------|
| **Own Profile / KYC** | ✅ Read/Write | ❌ | ❌ | ✅ Read |
| **Make Bookings** | ✅ (Online) | ✅ (Manual/Cash) | ✅ (Manual/Cash)| ✅ |
| **Cancel/Refund Bookings** | ⚠️ (Rules apply) | ❌ | ✅ | ✅ |
| **Manage Library Details**| ❌ | ❌ | ✅ (Own Library) | ✅ (All) |
| **Create Plans / Seats** | ❌ | ❌ | ✅ (Own Library) | ✅ (All) |
| **View Financial Reports**| ❌ | ❌ | ✅ (Own Library) | ✅ (All) |
| **View Live Entry Logs** | ❌ | ✅ (Own Library)| ✅ (Own Library) | ✅ (All) |
| **Manage Staff/Roles** | ❌ | ❌ | ✅ (Own Library) | ✅ (All) |
| **Global System Config** | ❌ | ❌ | ❌ | ✅ |

*(Derived from explicit roles in `schema.prisma` and frontend route grouping conventions).*

---

# Grounded Architecture Notes

### Evidence Log
* **Next.js & Structure**: The `src/app` directory utilizes the App Router paradigm. Route groups `(student)`, `dashboard`, and `admin` confirm the multi-tenant/multi-role web architecture.
* **Mobile API**: The existence of `src/app/api/mobile/` with heavy endpoints (`/myspace`, `/checkout/online`, `/qr`) proves a mobile app client interacts with this monolithic backend.
* **Two-Phase Booking Engine**: The database contains `BookingIntent` and `ResourceLease`. Code inside `src/lib/booking-engine` confirms complex booking validation to lock seats before Razorpay payment completion to avoid race conditions.
* **Hardware Integration**: The root directory contains `esp32_qr_access` and `arduino-cli` folders. Schema models `Relay` and `EntryLog`, alongside API routes in `src/app/api/hardware/log` and `/relay/sync` confirm custom IoT hardware acts as physical access gates.
* **Authentication**: Extensive use of Firebase admin (`src/lib/firebase/firebaseAdmin.ts`) and client SDKs. `verify-firebase-token.ts` acts as middleware.
* **KYC / Cashfree**: Verification paths trace to `src/app/api/kyc/cashfree/verify/route.ts` indicating Cashfree is used explicitly for Aadhaar/KYC identity checks.
* **Supabase Realtime**: `schema.prisma` connects to PostgreSQL via Prisma. However, `src/lib/supabase-client.ts` is explicitly imported by frontend components like `LiveEntryLogs.tsx` and `AccessQRModal.tsx`, proving Supabase is used for real-time WebSocket capabilities, directly listening to Postgres changes.

### Known Uncertainties / Unverified Components
* **Notifications Engine**: The schema contains a `Notification` model, and `notification-utils.ts` exists. However, it is not explicitly clear from a brief survey whether web push (VAPID) or Firebase Cloud Messaging (FCM) is the primary delivery mechanism in production.
* **Upstash / Redis Usage**: `@upstash/redis` and `@upstash/ratelimit` are in `package.json` and `src/lib/rate-limit.ts`. It is clearly configured, but its exact saturation across all critical API routes was not exhaustively mapped.
* **Blog/Sanity Usage**: The Sanity CMS integration exists (`src/sanity` and `/blog` routes), but its deployment status relative to the main application is assumed active based on route existence.
* **Cron Jobs / Refunds**: A `refund-worker.ts` exists and `RefundTask` model exists. The execution environment for background cron jobs (e.g., Vercel Cron vs external trigger) is not explicitly established solely from the repository layout.
