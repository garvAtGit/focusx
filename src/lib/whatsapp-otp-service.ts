import crypto from 'crypto';

interface StoredOtp {
  phone: string;
  otp: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

// Global in-memory storage for OTPs (persists across Next.js hot-reloads)
const globalForOtp = globalThis as unknown as {
  whatsappOtpStore: Map<string, StoredOtp> | undefined;
};

const otpStore: Map<string, StoredOtp> =
  globalForOtp.whatsappOtpStore || (globalForOtp.whatsappOtpStore = new Map());

// Clean up expired OTPs periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [phone, record] of otpStore.entries()) {
      if (record.expiresAt < now) {
        otpStore.delete(phone);
      }
    }
  }, 60_000);
}

/**
 * Generates a cryptographically secure 6-digit numeric OTP.
 */
export function generateNumericOtp(): string {
  const num = crypto.randomInt(100000, 999999);
  return num.toString();
}

/**
 * Creates and stores an OTP for a given phone number.
 * Rate-limited: max 1 OTP request every 25 seconds per number.
 */
export async function createAndStoreWhatsAppOtp(phone: string): Promise<{
  otp: string;
  expiresInSeconds: number;
  simulated: boolean;
  error?: string;
}> {
  const now = Date.now();
  const existing = otpStore.get(phone);

  if (existing && now - existing.lastSentAt < 25_000) {
    const waitTime = Math.ceil((25_000 - (now - existing.lastSentAt)) / 1000);
    return {
      otp: '',
      expiresInSeconds: 0,
      simulated: false,
      error: `Please wait ${waitTime} seconds before requesting a new code.`,
    };
  }

  const otp = generateNumericOtp();
  const validityMs = 5 * 60 * 1000; // 5 minutes

  otpStore.set(phone, {
    phone,
    otp,
    expiresAt: now + validityMs,
    attempts: 0,
    lastSentAt: now,
  });

  // Check if Meta WhatsApp Cloud API credentials are configured in .env.local
  const whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (whatsappToken && phoneNumberId) {
    try {
      const digitsOnly = phone.replace(/\D/g, '');
      const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME || 'focusx_auth_otp';

      const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
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

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[WhatsApp Cloud API Error]:', errorData);
        // Fall back to simulation log in non-prod
      } else {
        return {
          otp,
          expiresInSeconds: 300,
          simulated: false,
        };
      }
    } catch (apiErr) {
      console.error('[WhatsApp Cloud API Exception]:', apiErr);
    }
  }

  // Simulation / Local Sandbox Mode:
  console.log(`\n==================================================`);
  console.log(`🟢 [WHATSAPP OTP SIMULATOR - LOCAL MODE]`);
  console.log(`📱 Recipient: ${phone}`);
  console.log(`🔑 Verification OTP: ${otp}`);
  console.log(`⏳ Valid For: 5 minutes`);
  console.log(`==================================================\n`);

  return {
    otp,
    expiresInSeconds: 300,
    simulated: true,
  };
}

/**
 * Verifies a student's OTP.
 * Returns true if valid, deletes the OTP (one-time use), and protects against brute-force (max 5 attempts).
 */
export function verifyWhatsAppOtp(phone: string, inputOtp: string): {
  valid: boolean;
  error?: string;
} {
  const record = otpStore.get(phone);

  if (!record) {
    return { valid: false, error: 'OTP expired or not found. Please request a new code.' };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(phone);
    return { valid: false, error: 'OTP has expired. Please request a new code.' };
  }

  if (record.attempts >= 5) {
    otpStore.delete(phone);
    return { valid: false, error: 'Too many incorrect attempts. Please request a new code.' };
  }

  record.attempts += 1;

  if (record.otp !== inputOtp.trim()) {
    return { valid: false, error: 'Incorrect OTP code. Please check and try again.' };
  }

  // OTP is valid! Consume it (one-time use)
  otpStore.delete(phone);
  return { valid: true };
}
