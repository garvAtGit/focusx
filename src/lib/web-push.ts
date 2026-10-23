import webpush from "web-push";

/**
 * Standard Web Push (VAPID) infrastructure for FocusDesk
 */

export interface WebPushKeys {
  p256dh: string;
  auth: string;
}

export interface WebPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  timestamp?: number;
  data?: Record<string, any>;
}

export interface WebPushSendResult {
  success: boolean;
  statusCode?: number;
  isPermanent?: boolean;
  isTransient?: boolean;
  error?: string;
}

let vapidConfigured = false;

/**
 * Returns the public VAPID key configured on the server.
 */
export function getVapidPublicKey(): string | null {
  return (
    process.env.VAPID_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    null
  );
}

/**
 * Verifies if VAPID keys are properly set in server environment.
 */
export function isVapidConfigured(): boolean {
  const publicKey = getVapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  return Boolean(publicKey && privateKey);
}

/**
 * Configures the web-push library with VAPID details if available.
 */
export function configureVapid(): boolean {
  if (vapidConfigured) return true;

  const publicKey = getVapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:support@focusdesk.in";

  if (!publicKey || !privateKey) {
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    return true;
  } catch (err) {
    console.warn("[WebPush] Failed to configure VAPID details:", err);
    return false;
  }
}

/**
 * Sanitizes and validates action URLs to reject unsafe or external protocols.
 */
export function sanitizeActionUrl(url?: string): string {
  if (!url || typeof url !== "string") {
    return "/dashboard";
  }
  const trimmed = url.trim();
  // Only permit internal relative paths starting with /
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("javascript:")) {
    return trimmed;
  }
  return "/dashboard";
}

/**
 * Sends a Web Push notification to a single browser push subscription.
 * Categorizes errors cleanly into permanent failures (HTTP 404/410) vs transient failures (429/5xx).
 */
export async function sendWebPushNotification(
  subscription: WebPushSubscription,
  payload: PushNotificationPayload,
  options?: { ttl?: number }
): Promise<WebPushSendResult> {
  if (!subscription || !subscription.endpoint || !subscription.p256dh || !subscription.auth) {
    return {
      success: false,
      isPermanent: true,
      error: "Malformed subscription: missing endpoint or cryptographic keys",
    };
  }

  // Ensure VAPID is configured
  const ready = configureVapid();
  if (!ready) {
    // If running in development/test without live VAPID keys, report unconfigured
    return {
      success: false,
      isTransient: true,
      error: "VAPID keys not configured in environment",
    };
  }

  // Prepare sanitized payload
  const safePayload: PushNotificationPayload = {
    title: payload.title || "FocusDesk",
    body: payload.body || "",
    url: sanitizeActionUrl(payload.url),
    tag: payload.tag || `notif_${Date.now()}`,
    icon: payload.icon || "/icons/icon-192x192.png",
    badge: payload.badge || "/icons/icon-192x192.png",
    timestamp: payload.timestamp || Date.now(),
    data: payload.data || {},
  };

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  try {
    const res = await webpush.sendNotification(
      pushSubscription,
      JSON.stringify(safePayload),
      {
        TTL: options?.ttl ?? 86400, // 24 hours
        urgency: "normal",
      }
    );

    return {
      success: true,
      statusCode: res.statusCode,
    };
  } catch (err: any) {
    const statusCode = err.statusCode || (err.response ? err.response.statusCode : undefined);

    // 404 Not Found or 410 Gone indicates the subscription expired or user revoked browser permission
    if (statusCode === 404 || statusCode === 410) {
      return {
        success: false,
        statusCode,
        isPermanent: true,
        error: `Push service returned ${statusCode}: subscription expired or revoked`,
      };
    }

    // 429 Too Many Requests or 5xx Server Errors are transient
    if (statusCode === 429 || (statusCode >= 500 && statusCode <= 599)) {
      return {
        success: false,
        statusCode,
        isTransient: true,
        error: `Push service temporary error (${statusCode}): retry scheduled`,
      };
    }

    // Other errors (network timeout, connection reset, etc.)
    return {
      success: false,
      statusCode,
      isTransient: true,
      error: err.message || "Failed to deliver push notification",
    };
  }
}
