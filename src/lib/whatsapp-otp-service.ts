import crypto from 'crypto';
import { redis } from '@/lib/redis';

interface StoredOtp {
  phone: string;
  otp: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

// Global in-memory storage for OTPs fallback (persists across Next.js hot-reloads)
const globalForOtp = globalThis as unknown as {
  whatsappOtpStore: Map<string, StoredOtp> | undefined;
};

const memoryStore: Map<string, StoredOtp> =
  globalForOtp.whatsappOtpStore || (globalForOtp.whatsappOtpStore = new Map());

// Clean up expired OTPs periodically (unreferenced so it does not hold the process alive)
if (typeof setInterval !== 'undefined') {
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [phone, record] of memoryStore.entries()) {
      if (record.expiresAt < now) {
        memoryStore.delete(phone);
      }
    }
  }, 60_000);
  if (cleanupTimer.unref) cleanupTimer.unref();
}


/**
 * Generates a cryptographically secure 6-digit numeric OTP.
 */
export function generateNumericOtp(): string {
  try {
    const num = crypto.randomInt(100000, 999999);
    return num.toString();
  } catch {
    const bytes = crypto.randomBytes(4);
    const num = 100000 + (bytes.readUInt32BE(0) % 900000);
    return num.toString();
  }
}

function cleanEnv(val: string | undefined): string {
  if (!val) return '';
  return val.trim().replace(/^["']|["']$/g, '');
}

/**
 * Creates and stores an OTP for a given phone number.
 * Uses Redis with fallback to memory; rate-limits 25s per phone.
 */
export async function createAndStoreWhatsAppOtp(phone: string): Promise<{
  otp: string;
  expiresInSeconds: number;
  simulated: boolean;
  error?: string;
}> {
  const now = Date.now();
  const digitsOnly = phone.replace(/\D/g, '');
  const redisRateLimitKey = `whatsapp:rate:${digitsOnly}`;
  const redisOtpKey = `whatsapp:otp:${digitsOnly}`;

  // Check rate limit via Redis or memory
  let isRateLimited = false;
  let remainingWait = 25;

  try {
    if (redis) {
      const ttl = await redis.ttl(redisRateLimitKey);
      if (ttl > 0) {
        isRateLimited = true;
        remainingWait = ttl;
      }
    }
  } catch (err) {
    console.warn('[WhatsApp OTP] Redis check warning:', err);
  }

  if (!isRateLimited) {
    const memRecord = memoryStore.get(digitsOnly);
    if (memRecord && now - memRecord.lastSentAt < 25_000) {
      isRateLimited = true;
      remainingWait = Math.ceil((25_000 - (now - memRecord.lastSentAt)) / 1000);
    }
  }

  if (isRateLimited) {
    return {
      otp: '',
      expiresInSeconds: 0,
      simulated: false,
      error: `Please wait ${remainingWait}s before requesting a new code.`,
    };
  }

  const otp = generateNumericOtp();
  const validitySeconds = 300; // 5 minutes

  // Persist to Redis
  try {
    if (redis) {
      await redis.set(
        redisOtpKey,
        JSON.stringify({ phone, otp, attempts: 0 }),
        { ex: validitySeconds }
      );
      await redis.set(redisRateLimitKey, '1', { ex: 25 });
    }
  } catch (err) {
    console.warn('[WhatsApp OTP] Redis set warning:', err);
  }

  // Also keep in memory as backup
  memoryStore.set(digitsOnly, {
    phone,
    otp,
    expiresAt: now + validitySeconds * 1000,
    attempts: 0,
    lastSentAt: now,
  });

  // Check Meta WhatsApp Cloud API credentials
  const whatsappToken = cleanEnv(process.env.WHATSAPP_ACCESS_TOKEN);
  const phoneNumberId = cleanEnv(process.env.WHATSAPP_PHONE_NUMBER_ID);
  const templateName = cleanEnv(process.env.WHATSAPP_OTP_TEMPLATE_NAME) || 'focusx_auth';

  if (whatsappToken && phoneNumberId) {
    try {
      let response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${whatsappToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: digitsOnly,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: otp }],
              },
              {
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [{ type: 'text', text: otp }],
              },
            ],
          },
        }),
      });

      // If template structure does not have the URL button or parameter count differs, retry with body-only payload
      if (!response.ok) {
        const initialError = await response.clone().json().catch(() => null);
        console.warn('[WhatsApp Cloud API Initial Attempt]:', initialError);

        const retryResponse = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${whatsappToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: digitsOnly,
            type: 'template',
            template: {
              name: templateName,
              language: { code: 'en' },
              components: [
                {
                  type: 'body',
                  parameters: [{ type: 'text', text: otp }],
                },
              ],
            },
          }),
        });

        if (retryResponse.ok) {
          response = retryResponse;
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[WhatsApp Cloud API Error]:', errorData);
        return {
          otp: '',
          expiresInSeconds: 0,
          simulated: false,
          error: 'Failed to dispatch WhatsApp OTP. Please use "Send code via SMS" below.',
        };
      }

      return {
        otp,
        expiresInSeconds: validitySeconds,
        simulated: false,
      };
    } catch (apiErr) {
      console.error('[WhatsApp Cloud API Exception]:', apiErr);
      return {
        otp: '',
        expiresInSeconds: 0,
        simulated: false,
        error: 'WhatsApp network error. Please use "Send code via SMS" below.',
      };
    }
  }

  // Simulation mode (Local / Sandbox development without credentials)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n==================================================`);
    console.log(`🟢 [WHATSAPP OTP SIMULATOR - LOCAL MODE]`);
    console.log(`📱 Recipient: ${phone}`);
    console.log(`🔑 Verification OTP: ${otp}`);
    console.log(`⏳ Valid For: 5 minutes`);
    console.log(`==================================================\n`);

    return {
      otp,
      expiresInSeconds: validitySeconds,
      simulated: true,
    };
  }

  return {
    otp: '',
    expiresInSeconds: 0,
    simulated: false,
    error: 'WhatsApp service is temporarily unavailable. Please use SMS verification below.',
  };
}

/**
 * Verifies a student's OTP. Checks Redis first, then in-memory fallback.
 */
export async function verifyWhatsAppOtp(
  phone: string,
  inputOtp: string
): Promise<{
  valid: boolean;
  error?: string;
}> {
  const digitsOnly = phone.replace(/\D/g, '');
  const redisOtpKey = `whatsapp:otp:${digitsOnly}`;
  const now = Date.now();

  let storedOtp: string | null = null;
  let attempts = 0;

  // Check Redis
  try {
    if (redis) {
      const data = await redis.get<string | { otp: string; attempts: number }>(redisOtpKey);
      if (data) {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        storedOtp = parsed.otp;
        attempts = parsed.attempts || 0;
      }
    }
  } catch (err) {
    console.warn('[WhatsApp OTP] Redis get warning:', err);
  }

  // Fallback to memory
  if (!storedOtp) {
    const memRecord = memoryStore.get(digitsOnly);
    if (memRecord) {
      if (memRecord.expiresAt < now) {
        memoryStore.delete(digitsOnly);
        return { valid: false, error: 'OTP has expired. Please request a new code.' };
      }
      storedOtp = memRecord.otp;
      attempts = memRecord.attempts;
    }
  }

  if (!storedOtp) {
    return { valid: false, error: 'OTP expired or not found. Please request a new code.' };
  }

  if (attempts >= 5) {
    try {
      if (redis) await redis.del(redisOtpKey);
    } catch {}
    memoryStore.delete(digitsOnly);
    return { valid: false, error: 'Too many incorrect attempts. Please request a new code.' };
  }

  if (storedOtp !== inputOtp.trim()) {
    // Increment attempts
    try {
      if (redis) {
        const ttl = await redis.ttl(redisOtpKey);
        if (ttl > 0) {
          await redis.set(
            redisOtpKey,
            JSON.stringify({ phone, otp: storedOtp, attempts: attempts + 1 }),
            { ex: ttl }
          );
        }
      }
    } catch {}

    const memRecord = memoryStore.get(digitsOnly);
    if (memRecord) memRecord.attempts += 1;

    return { valid: false, error: 'Incorrect OTP code. Please check and try again.' };
  }

  // OTP is valid! Invalidate immediately
  try {
    if (redis) await redis.del(redisOtpKey);
  } catch {}
  memoryStore.delete(digitsOnly);

  return { valid: true };
}
