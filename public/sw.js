// FocusDesk Service Worker — PWA & Web Push Notification Handler

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // BYPASS EVERYTHING FOR DIAGNOSTICS
  return;
});

// ---------------------------------------------------------------------------
// WEB PUSH EVENT HANDLER
// ---------------------------------------------------------------------------

self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let data = {};
  try {
    data = event.data.json();
  } catch (err) {
    data = {
      title: "FocusDesk Notification",
      body: event.data.text(),
      url: "/dashboard",
    };
  }

  const title = data.title || "FocusDesk Notification";
  let actionUrl = data.url || "/dashboard";

  // Sanitize action URL: must be a local path
  if (!actionUrl.startsWith("/") || actionUrl.startsWith("//") || actionUrl.includes("javascript:")) {
    actionUrl = "/dashboard";
  }

  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192x192.png",
    badge: data.badge || "/icons/icon-192x192.png",
    tag: data.tag || `focusdesk_notif_${Date.now()}`,
    data: {
      url: actionUrl,
      tag: data.tag,
      timestamp: data.timestamp || Date.now(),
    },
    renotify: false,
    requireInteraction: false,
  };

  const promiseChain = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      // Check if any window of this website is currently focused and visible
      const isFocused = clientList.some(
        (client) => client.focused && client.visibilityState === 'visible'
      );

      // If website is actively focused in foreground:
      if (isFocused) {
        // Broadcast to foreground client to display in-app top-right toast and update bell/inbox
        for (const client of clientList) {
          client.postMessage({
            type: 'FOCUSDESK_PUSH_RECEIVED',
            payload: { ...data, isForeground: true },
          });
        }
        // Avoid redundant OS notification duplication when user is actively focused on the tab
        return Promise.resolve();
      }

      // When website is backgrounded or closed, display browser/OS notification
      return self.registration.showNotification(title, options);
    });

  event.waitUntil(promiseChain);
});

// ---------------------------------------------------------------------------
// NOTIFICATION CLICK HANDLER
// ---------------------------------------------------------------------------

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  let targetUrl = event.notification.data?.url || '/dashboard';

  // Sanitize navigation destination
  if (!targetUrl.startsWith('/') || targetUrl.startsWith('//') || targetUrl.includes('javascript:')) {
    targetUrl = '/dashboard';
  }

  const destination = new URL(targetUrl, self.location.origin).href;

  const promiseChain = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      // If a matching window exists, focus it and navigate
      for (const client of clientList) {
        if (client.url === destination && 'focus' in client) {
          return client.focus();
        }
      }
      for (const client of clientList) {
        if ('focus' in client && 'navigate' in client) {
          return client.focus().then(() => client.navigate(destination));
        }
      }
      // If no window open, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(destination);
      }
    });

  event.waitUntil(promiseChain);
});
