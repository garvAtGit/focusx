import { redis } from './redis';

export interface ExpoPushMessagePayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: 'default' | 'normal' | 'high';
  sound?: string;
  channelId?: string;
}

/**
 * Validates if a string looks like an Expo push token.
 */
export function isValidExpoPushToken(token: unknown): token is string {
  return typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));
}

/**
 * Registers an Expo push token for a user in Upstash Redis.
 * Caches token for 90 days with automatic refresh.
 */
export async function registerDevicePushToken(
  userId: string,
  token: string,
  platform = 'android'
): Promise<void> {
  if (!userId || !token || !isValidExpoPushToken(token)) return;

  try {
    const TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days
    // 1. Direct primary lookup: push_token:<userId>
    await redis.set(`push_token:${userId}`, token, { ex: TTL_SECONDS });

    // 2. Metadata: push_meta:<userId>
    await redis.set(
      `push_meta:${userId}`,
      JSON.stringify({
        token,
        platform,
        registeredAt: new Date().toISOString(),
      }),
      { ex: TTL_SECONDS }
    );

    // 3. User token set (for multi-device support)
    await redis.sadd(`user_tokens:${userId}`, token);

    // 4. Global active tokens set
    await redis.sadd('active_mobile_push_tokens', token);
  } catch (err) {
    console.warn('[ExpoPush] Failed to register push token in Redis:', err);
  }
}

/**
 * Retrieves all registered Expo push tokens for a given array of user IDs.
 */
export async function getDeviceTokensForUsers(userIds: string[]): Promise<string[]> {
  if (!userIds || userIds.length === 0) return [];
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  const tokens = new Set<string>();

  try {
    // Pipeline or chunked mget for ultra-fast lookup
    const CHUNK = 50;
    for (let i = 0; i < uniqueUserIds.length; i += CHUNK) {
      const slice = uniqueUserIds.slice(i, i + CHUNK);
      const keys = slice.map((id) => `push_token:${id}`);
      const results = (await redis.mget(...keys)) as Array<string | null>;

      for (const token of results) {
        if (isValidExpoPushToken(token)) {
          tokens.add(token);
        }
      }
    }
  } catch (err) {
    console.warn('[ExpoPush] Error retrieving tokens from Redis:', err);
  }

  return Array.from(tokens);
}

/**
 * Sends push notifications to a list of tokens via Expo Push API in bounded chunks of 100.
 */
export async function sendExpoPushNotifications(
  tokens: string[],
  payload: ExpoPushMessagePayload
): Promise<{ successCount: number; failureCount: number }> {
  const validTokens = Array.from(new Set(tokens.filter(isValidExpoPushToken)));
  if (validTokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  const messages = validTokens.map((token) => ({
    to: token,
    sound: payload.sound || 'default',
    title: payload.title,
    body: payload.body,
    channelId: payload.channelId || 'default',
    data: payload.data || {},
    priority: payload.priority || 'high',
  }));

  let successCount = 0;
  let failureCount = 0;
  const CHUNK_SIZE = 100; // Expo maximum per HTTP POST

  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      if (!res.ok) {
        console.error('[ExpoPush] HTTP Error from Expo server:', res.status, await res.text());
        failureCount += chunk.length;
        continue;
      }

      const json = await res.json();
      const tickets = json.data || [];

      for (let j = 0; j < tickets.length; j++) {
        const ticket = tickets[j];
        if (ticket.status === 'ok') {
          successCount++;
        } else {
          failureCount++;
          console.warn('[ExpoPush] Ticket error:', ticket.message, ticket.details);

          // Clean up invalid or uninstalled tokens automatically
          if (ticket.details?.error === 'DeviceNotRegistered') {
            const staleToken = chunk[j]?.to;
            if (staleToken) {
              redis.srem('active_mobile_push_tokens', staleToken).catch(() => {});
            }
          }
        }
      }
    } catch (err) {
      console.error('[ExpoPush] Network error sending push batch:', err);
      failureCount += chunk.length;
    }
  }

  return { successCount, failureCount };
}

/**
 * High-level orchestrator: Looks up device tokens for student user IDs and dispatches mobile push alerts.
 */
export async function dispatchMobilePushToUsers(
  userIds: string[],
  payload: ExpoPushMessagePayload
): Promise<{ targetCount: number; sentCount: number; failedCount: number }> {
  if (!userIds || userIds.length === 0) {
    return { targetCount: 0, sentCount: 0, failedCount: 0 };
  }

  try {
    const tokens = await getDeviceTokensForUsers(userIds);
    if (tokens.length === 0) {
      return { targetCount: userIds.length, sentCount: 0, failedCount: 0 };
    }

    const { successCount, failureCount } = await sendExpoPushNotifications(tokens, payload);
    return {
      targetCount: tokens.length,
      sentCount: successCount,
      failedCount: failureCount,
    };
  } catch (err) {
    console.error('[ExpoPush] dispatchMobilePushToUsers error:', err);
    return { targetCount: userIds.length, sentCount: 0, failedCount: userIds.length };
  }
}
