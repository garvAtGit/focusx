import crypto from 'crypto';

/**
 * Resolve the Cashfree verification base URL from the environment.
 *
 * Defaults to sandbox so a missing/mistyped env var can never silently point
 * real users at production (or vice-versa). Set CASHFREE_ENV=production to use
 * the live endpoint.
 */
export function getCashfreeBaseUrl(): string {
  const env = (process.env.CASHFREE_ENV || 'sandbox').trim().toLowerCase();
  const isProd = env === 'production' || env === 'prod' || env === 'live';
  return isProd
    ? 'https://api.cashfree.com/verification/digilocker'
    : 'https://sandbox.cashfree.com/verification/digilocker';
}

/** Cashfree statuses we treat as a completed, trustworthy verification. */
const SUCCESS_STATUSES = new Set(['SUCCESS', 'VALID', 'VERIFIED', 'COMPLETED']);

/** True only when the verification response represents a real success. */
export function isCashfreeSuccess(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const response = data as Record<string, unknown>;
  const document = (
    response.document && typeof response.document === 'object'
      ? response.document
      : {}
  ) as Record<string, unknown>;
  const candidates = [
    response.status,
    response.verification_status,
    document.status,
  ];
  return candidates.some(
    (s) => typeof s === 'string' && SUCCESS_STATUSES.has(s.trim().toUpperCase()),
  );
}

export function getCashfreeSignature(clientId: string): string | null {
  const publicKey = process.env.CASHFREE_PUBLIC_KEY;
  if (!publicKey) return null;

  // Cashfree requires clientId.timestamp encrypted with the public key
  const timestamp = Math.floor(Date.now() / 1000);
  const dataToSign = `${clientId}.${timestamp}`;

  try {
    const encrypted = crypto.publicEncrypt(
      {
        // Env vars store the PEM with literal "\n" sequences; convert them to
        // real newlines so the key parses.
        key: publicKey.replace(/\\n/g, '\n'),
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      },
      Buffer.from(dataToSign)
    );
    return encrypted.toString('base64');
  } catch (e) {
    console.error('Failed to generate Cashfree Signature:', e);
    return null;
  }
}
