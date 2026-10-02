# System Map

## Conceptual View 1: Current System (Verified Active)
This diagram shows **only** components with sufficient evidence of active usage in the current runtime system.

![System Overview](diagrams/00-system-overview.mmd)

## Conceptual View 2: Implementation / Repository Map
This diagram includes all implemented features, configurations, and intended integrations found in the repository, including those that cannot be verified as active in production.

```mermaid
flowchart TD
    %% Actors
    StudentWeb[Student Web App]
    StudentMobile[Student Mobile App (UNKNOWN)]
    Librarian[Staff Dashboard]
    Admin[Admin Dashboard]
    Hardware[ESP32/NodeMCU Hardware (IMPLEMENTED)]

    %% Main Next.js Monolith
    subgraph Monolith [Next.js Repository]
        UI_Student[Student Portal /app/student]
        UI_Dashboard[Staff Dashboard /app/dashboard]
        UI_Admin[Admin Portal /app/admin]
        UI_Blog[Blog /app/blog]
        
        API_Mobile[Mobile APIs /api/mobile]
        API_Hardware[Hardware APIs /api/hardware]
        API_Webhooks[Webhooks /api/webhooks]
        
        Worker[Refund Worker /lib/refund-worker.ts (CONFIGURED)]
    end

    %% Infrastructure & Data
    Database[(PostgreSQL via Prisma)]
    Redis[(Upstash Redis via rate-limit.ts)]
    Deployment[Vercel Deployment (CONFIGURED)]
    
    %% External Services
    Firebase[Firebase Auth]
    Razorpay[Razorpay Payments]
    Cashfree[Cashfree KYC]
    ImageKit[ImageKit Storage]
    Sanity[Sanity CMS (CONFIGURED)]
    Supabase[Supabase Realtime]

    %% Connections
    StudentWeb --> UI_Student
    StudentWeb --> UI_Blog
    Librarian --> UI_Dashboard
    Admin --> UI_Admin
    StudentMobile -.- API_Mobile
    Hardware -.- API_Hardware
    
    UI_Student --> Database
    UI_Dashboard --> Database
    UI_Admin --> Database
    API_Mobile --> Database
    API_Webhooks --> Database
    API_Hardware --> Database
    Worker -.- Database
    
    UI_Student --> Redis
    API_Mobile --> Redis
    
    UI_Student -.-> Firebase
    UI_Dashboard -.-> Firebase
    
    Database -.-> Razorpay
    Razorpay -.-> API_Webhooks
    
    UI_Student -.-> Cashfree
    UI_Blog -.-> Sanity
    UI_Student -.-> ImageKit
    
    Database -.-> Supabase
    Supabase -.-> UI_Dashboard
    Monolith -.- Deployment
```
