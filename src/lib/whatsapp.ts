/**
 * Formats a phone number for WhatsApp wa.me links.
 * Handles Indian numbers (+91, leading 0, 10-digit without country code) and international numbers.
 */
export function formatWhatsAppPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;

  // 10-digit mobile number (India standard) -> prefix 91
  if (digits.length === 10) {
    return `91${digits}`;
  }

  // 11-digit mobile starting with 0 -> replace 0 with 91
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }

  // Already has country code (e.g., 919876543210 or 14155552671)
  return digits;
}

/**
 * Returns the full https://wa.me/ URL with optional URL-encoded text.
 */
export function getWhatsAppUrl(phone: string | null | undefined, text?: string): string | null {
  const formatted = formatWhatsAppPhone(phone);
  if (!formatted) return null;
  const encodedText = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${formatted}${encodedText}`;
}

/**
 * Opens a WhatsApp chat directly in a new tab.
 */
export function openWhatsAppChat(phone: string | null | undefined, text?: string): boolean {
  const url = getWhatsAppUrl(phone, text);
  if (!url) return false;
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }
  return false;
}

/**
 * Formats a title and message into a clean, bolded WhatsApp message text.
 */
export function formatNotificationForWhatsApp(
  title: string,
  message: string,
  libraryName?: string,
  actionUrl?: string | null
): string {
  const parts: string[] = [];

  if (libraryName) {
    parts.push(`🏛️ *${libraryName.trim()}*`);
  }

  if (title.trim()) {
    parts.push(`📢 *${title.trim()}*`);
  }

  if (message.trim()) {
    parts.push(message.trim());
  }

  if (actionUrl && actionUrl.trim()) {
    const fullUrl = actionUrl.startsWith('http')
      ? actionUrl
      : `https://www.focusx.in${actionUrl.startsWith('/') ? actionUrl : `/${actionUrl}`}`;
    parts.push(`🔗 Details: ${fullUrl}`);
  }

  parts.push(`\n— Sent via FocusX`);

  return parts.join('\n\n');
}

