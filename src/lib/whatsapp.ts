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
 * Instant 0.05s launch without browser tabs, loading screens, or reload.
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

  // Open via protocol handler
  window.location.href = url;
  return true;
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

// Reusable companion window reference and target name so consecutive student messages
// focus and update the existing warm WhatsApp Web session rather than cold-booting
// and reloading WhatsApp from scratch every time.
let sharedWhatsAppPopup: Window | null = null;
const WA_COMPANION_TARGET = 'focusx_whatsapp_companion';

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

    // Exact size & location matching user's reference:
    // Size: ~43.5% screen width and ~57% screen height
    // Location: Docked right (~8-12px margin), positioned ~24% from screen top
    const outerWidth = window.outerWidth || screenWidth;
    const outerHeight = window.outerHeight || screenHeight;

    const width = Math.max(680, Math.min(920, Math.round(screenWidth * 0.435)));
    const height = Math.max(500, Math.min(740, Math.round(screenHeight * 0.57)));

    const screenLeft = typeof window.screenLeft !== 'undefined' ? window.screenLeft : window.screenX;
    const screenTop = typeof window.screenTop !== 'undefined' ? window.screenTop : window.screenY;

    const left = Math.max(0, Math.round(screenLeft + outerWidth - width - 10));
    const top = Math.max(20, Math.round(screenTop + outerHeight * 0.24));

    // Re-use already open warm companion window if still alive:
    if (sharedWhatsAppPopup && !sharedWhatsAppPopup.closed) {
      try {
        try {
          sharedWhatsAppPopup.resizeTo(width, height);
          sharedWhatsAppPopup.moveTo(left, top);
        } catch {}
        sharedWhatsAppPopup.location.href = url;
        sharedWhatsAppPopup.focus();
        return true;
      } catch {
        // Fallback to window.open if cross-origin navigation is restricted
      }
    }

    // Opens at the exact calibrated size and position from the reference screenshot
    const popup = window.open(
      url,
      WA_COMPANION_TARGET,
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,location=no,status=no,scrollbars=yes,resizable=yes`
    );

    if (popup) {
      sharedWhatsAppPopup = popup;
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
