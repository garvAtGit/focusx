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
 * Opens WhatsApp Web directly (skipping the intermediate "Download / Continue to Web" page)
 * as a companion side window (740px x 800px) docked gracefully to the right side of the screen
 * so the dashboard remains visible on the left and WhatsApp chat opens immediately with pre-filled text.
 *
 * On mobile:
 * Opens via deep link to launch the native WhatsApp app directly.
 */
export function openWhatsAppChat(
  phone: string | null | undefined, 
  text?: string, 
  asCompactPopup: boolean = true
): boolean {
  if (typeof window === 'undefined') return false;

  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 640;
  const url = isMobile 
    ? getWhatsAppUrl(phone, text) 
    : getWhatsAppWebUrl(phone, text);

  if (!url) return false;

  if (!isMobile && asCompactPopup) {
    const screenWidth = window.screen.availWidth || window.innerWidth;
    const screenHeight = window.screen.availHeight || window.innerHeight;

    // Proportioned companion window shape:
    // ~720px - 780px width accommodates both the chat panel and contact context cleanly
    // without awkward clipping or squishing.
    const width = Math.min(800, Math.max(720, Math.round(screenWidth * 0.44)));
    const height = Math.min(860, Math.max(720, Math.round(screenHeight * 0.84)));

    const screenLeft = typeof window.screenLeft !== 'undefined' ? window.screenLeft : window.screenX;
    const screenTop = typeof window.screenTop !== 'undefined' ? window.screenTop : window.screenY;
    const outerWidth = window.outerWidth || screenWidth;

    // Dock right-aligned so the dashboard remains visible on the left
    const left = Math.max(0, Math.round(screenLeft + outerWidth - width - 24));
    const top = Math.max(20, Math.round(screenTop + 36));

    const popup = window.open(
      url,
      `wa_direct_${formatWhatsAppPhone(phone)}`,
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,location=no,status=no,scrollbars=yes,resizable=yes`
    );

    if (popup) {
      popup.focus();
      return true;
    }
  }

  // Fallback for mobile devices or if popup was blocked
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
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
