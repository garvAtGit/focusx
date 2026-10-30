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
 * Returns the full WhatsApp direct chat URL with optional pre-filled text.
 * Uses api.whatsapp.com/send which routes directly to the single chat thread
 * on both WhatsApp Web and native mobile/desktop apps.
 */
export function getWhatsAppUrl(phone: string | null | undefined, text?: string): string | null {
  const formatted = formatWhatsAppPhone(phone);
  if (!formatted) return null;
  const encodedText = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://api.whatsapp.com/send?phone=${formatted}${encodedText}`;
}

/**
 * Opens a WhatsApp chat directly for that person.
 *
 * To open ONLY that person's direct chat without the left sidebar (conversation list):
 * We launch a centered compact window (560px x 760px).
 * Because WhatsApp Web is responsive, when the viewport width is below 750px,
 * it completely collapses and hides the left sidebar, showing ONLY that student's single chat!
 */
export function openWhatsAppChat(
  phone: string | null | undefined, 
  text?: string, 
  asCompactPopup: boolean = true
): boolean {
  const url = getWhatsAppUrl(phone, text);
  if (!url) return false;

  if (typeof window !== 'undefined') {
    // If on a desktop/laptop browser, open as a compact focused popup window
    // to hide WhatsApp's sidebar and show ONLY that student's chat.
    if (asCompactPopup && window.innerWidth >= 640) {
      const width = 560;
      const height = 760;
      const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
      const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
      
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
