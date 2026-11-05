/**
 * Formats a phone number for WhatsApp wa.me / api.whatsapp.com links.
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
 * Returns the direct WhatsApp Web URL with pre-filled text.
 * Used on desktop browsers to bypass the intermediate "Open App / Continue to WhatsApp Web" screen.
 */
/**
 * Returns the native WhatsApp Desktop protocol URI.
 * Launches WhatsApp for Windows/Mac desktop app directly with 0 reload and 0 browser tabs.
 */
export function getWhatsAppDesktopUrl(phone: string | null | undefined, text?: string): string | null {
  const formatted = formatWhatsAppPhone(phone);
  if (!formatted) return null;
  const encodedText = text ? `&text=${encodeURIComponent(text)}` : '';
  return `whatsapp://send?phone=${formatted}${encodedText}`;
}

/**
 * Opens WhatsApp using the native desktop app (whatsapp:// URI scheme).
 * Instant launch without browser tabs or reload, and strictly no auto-fallback to web.
 */
export function openWhatsAppDesktop(phone: string | null | undefined, text?: string): boolean {
  if (typeof window === 'undefined') return false;
  const url = getWhatsAppDesktopUrl(phone, text);
  if (!url) return false;

  // Auto-copy text to clipboard as guaranteed backup
  if (text && typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      navigator.clipboard.writeText(text).catch(() => {});
    } catch {}
  }

  // Open via protocol handler without navigating away or auto-falling back
  try {
    const link = document.createElement('a');
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch {
    window.location.href = url;
    return true;
  }
}

export function getWhatsAppWebUrl(phone: string | null | undefined, text?: string): string | null {
  const formatted = formatWhatsAppPhone(phone);
  if (!formatted) return null;
  const encodedText = text ? `&text=${encodeURIComponent(text)}` : '';
  return `https://web.whatsapp.com/send?phone=${formatted}${encodedText}`;
}

/**
 * Returns the universal WhatsApp URL with optional pre-filled text.
 * Uses api.whatsapp.com/send which routes directly on mobile devices to the native WhatsApp app.
 */
export function getWhatsAppUrl(phone: string | null | undefined, text?: string): string | null {
  const formatted = formatWhatsAppPhone(phone);
  if (!formatted) return null;
  const encodedText = text ? `&text=${encodeURIComponent(text)}` : '';
  return `https://api.whatsapp.com/send/?phone=${formatted}${encodedText}`;
}

/**
 * Opens a WhatsApp chat directly for that person.
 *
 * On desktop:
 * Opens WhatsApp Web directly in a new browser tab with the student's conversation
 * and pre-filled message text.
 *
 * On mobile:
 * Opens via deep link (api.whatsapp.com / wa.me) to launch the native WhatsApp app directly.
 */
export function openWhatsAppChat(
  phone: string | null | undefined, 
  text?: string, 
  asCompactPopup?: boolean
): boolean {
  if (typeof window === 'undefined') return false;

  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 640;
  
  // Auto-copy text to clipboard as guaranteed backup so text is never lost
  if (text && typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      navigator.clipboard.writeText(text).catch(() => {});
    } catch {}
  }

  const url = isMobile 
    ? getWhatsAppUrl(phone, text) 
    : getWhatsAppWebUrl(phone, text);

  if (!url) return false;

  // 1. Primary: open in a fresh, unblocked browser tab
  try {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (win && !win.closed) {
      win.focus();
      return true;
    }
  } catch (err) {
    console.warn('[WhatsApp] window.open failed, trying link fallback:', err);
  }

  // 2. Fallback: Native anchor trigger (completely immune to popup blockers in modern browsers)
  try {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (linkErr) {
    console.warn('[WhatsApp] Anchor trigger failed, using location.href:', linkErr);
    window.location.href = url;
    return true;
  }
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
