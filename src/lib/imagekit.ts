import ImageKit from "imagekit";

const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || "";
const privateKey = process.env.IMAGEKIT_PRIVATE_KEY || "";
const urlEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || "";

export const imagekitConfigured = Boolean(publicKey && privateKey && urlEndpoint);

const imagekit = imagekitConfigured
  ? new ImageKit({ publicKey, privateKey, urlEndpoint })
  : null;

/**
 * Upload an image to ImageKit and return its CDN URL.
 *
 * Accepts a Buffer or a base64 string. Storing images on a CDN (instead of as
 * base64 in Postgres) keeps rows small and responses fast at scale.
 *
 * Falls back to an inline data URL only when ImageKit isn't configured (e.g.
 * local dev) so the feature still works without external creds.
 */
export async function uploadImage(
  data: Buffer | string,
  fileName: string,
  folder = "/uploads",
  mimeTypeForFallback = "image/jpeg",
): Promise<string> {
  if (imagekit) {
    const uploadPromise = imagekit.upload({
      file: data,
      fileName,
      folder,
      useUniqueFileName: true,
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('ImageKit upload timed out after 15s')), 15_000)
    );
    const res = await Promise.race([uploadPromise, timeoutPromise]);
    return res.url;
  }

  // In production, ImageKit MUST be configured — fail loudly instead of
  // silently storing multi-KB base64 strings in Postgres.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ImageKit is not configured. Set NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT.');
  }

  // Dev fallback: inline data URL (only used in local development).
  const base64 = Buffer.isBuffer(data) ? data.toString("base64") : data;
  return `data:${mimeTypeForFallback};base64,${base64}`;
}
