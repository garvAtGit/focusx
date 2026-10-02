# Uncertainties & Unverified Components

The following components exist in the repository, but active production usage or deployment cannot be fully established solely from codebase evidence.

## 1. Vercel Deployment
- **Status**: CONFIGURED_NOT_VERIFIED
- **Confidence**: MEDIUM
- **Evidence**: `.env.vercel`, `.vercelignore`, and `vercel.json`.
- **Note**: These files configure a Vercel deployment, but do not prove that the current active production environment runs on Vercel.

## 2. Mobile Application
- **Status**: UNKNOWN
- **Confidence**: LOW
- **Evidence**: The repository contains `src/app/api/mobile/` with heavy REST endpoints designed for a mobile client.
- **Note**: A Mobile API is **ACTIVE**. However, no codebase for the mobile application itself (e.g., React Native, Flutter, Swift) exists in this repository. Production usage of the mobile app cannot be established.

## 3. Hardware Relays
- **Status**: IMPLEMENTED_NOT_VERIFIED
- **Confidence**: MEDIUM
- **Evidence**: The root contains `esp32_qr_access/` and `arduino-cli/`. Backend APIs like `src/app/api/hardware/log/route.ts` exist.
- **Note**: While the firmware and backend endpoints are implemented, we cannot verify if physical relays are currently deployed and operating in production libraries.

## 4. Background Push Notifications
- **Status**: CONFIGURED_NOT_VERIFIED
- **Confidence**: MEDIUM
- **Evidence**: A `Notification` database model exists, and `src/lib/notification-utils.ts` exists.
- **Note**: The exact delivery mechanism (Firebase Cloud Messaging vs. Web VAPID Push) and active execution paths were not fully traced to an active production endpoint.

## 5. Background Cron Jobs (Refund Worker)
- **Status**: CONFIGURED_NOT_VERIFIED
- **Confidence**: MEDIUM
- **Evidence**: `src/lib/refund-worker.ts` and the `RefundTask` model exist.
- **Note**: It is not explicitly clear from the repository structure what executes the cron job in production (e.g., Vercel Cron, external trigger, or a separate worker dyno).

## 6. Sanity CMS Blog
- **Status**: CONFIGURED_NOT_VERIFIED
- **Confidence**: MEDIUM
- **Evidence**: `src/sanity/` schemas and `src/app/blog/` pages.
- **Note**: While implemented, it's unclear if the blog is actively used in production or merely a scaffolded feature.
