'use client';

import React, { useEffect, useState, useTransition } from 'react';
import {
  Bell,
  BellOff,
  CheckCircle2,
  AlertTriangle,
  Info,
  Smartphone,
  ShieldAlert,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  getVapidPublicKeyAction,
  registerPushSubscriptionAction,
  removePushSubscriptionAction,
  updatePushPreferenceAction,
  getPushSubscriptionStatusAction,
} from '@/app/actions/notification-actions';

/**
 * Converts a base64url string into a Uint8Array for PushManager subscription.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function BrowserPushSettings() {
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [browserPushEnabled, setBrowserPushEnabled] = useState<boolean>(true);
  const [activeDeviceCount, setActiveDeviceCount] = useState<number>(0);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Initial detection & server state sync
  useEffect(() => {
    async function checkState() {
      setIsLoading(true);
      try {
        const supported =
          typeof window !== 'undefined' &&
          'serviceWorker' in navigator &&
          'PushManager' in window &&
          'Notification' in window;

        setIsSupported(supported);

        if (supported) {
          setPermission(Notification.permission);

          // Check if active service worker has a push subscription
          try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            if (sub) {
              setIsSubscribed(true);
              setCurrentEndpoint(sub.endpoint);
            } else {
              setIsSubscribed(false);
              setCurrentEndpoint(null);
            }
          } catch (e) {
            console.warn('[PushSettings] Error reading push subscription:', e);
          }
        }

        // Fetch server-side preference & registered device count
        const serverStatus = await getPushSubscriptionStatusAction();
        if (serverStatus.success) {
          setBrowserPushEnabled(serverStatus.browserPushEnabled ?? true);
          setActiveDeviceCount(serverStatus.activeSubscriptionsCount ?? 0);
        }
      } catch (err: any) {
        console.warn('[PushSettings] Initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    checkState();
  }, []);

  // Request browser permission and subscribe
  async function handleEnablePush() {
    setActionError(null);
    setActionSuccess(null);

    if (!isSupported) {
      setActionError('Browser push notifications are not supported in your browser.');
      return;
    }

    startTransition(async () => {
      try {
        // 1. Explicit user permission prompt (ONLY triggered by button click)
        const newPermission = await Notification.requestPermission();
        setPermission(newPermission);

        if (newPermission === 'denied') {
          setActionError('Notification permission was denied. Please update your browser site settings to enable notifications.');
          return;
        }

        if (newPermission !== 'granted') {
          return;
        }

        // 2. Retrieve public VAPID key
        const vapidRes = await getVapidPublicKeyAction();
        if (!vapidRes.success || !vapidRes.publicKey) {
          setActionError(vapidRes.error || 'Push notification service is not configured on the server (missing VAPID key).');
          return;
        }

        // 3. Obtain service worker registration
        const registration = await navigator.serviceWorker.ready;

        // 4. Subscribe to browser PushManager
        const applicationServerKey = urlBase64ToUint8Array(vapidRes.publicKey);
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as unknown as BufferSource,
        });

        // 5. Serialize cryptographic keys
        const rawKey = subscription.getKey ? subscription.getKey('p256dh') : null;
        const rawAuth = subscription.getKey ? subscription.getKey('auth') : null;

        if (!rawKey || !rawAuth) {
          throw new Error('Failed to retrieve encryption keys from browser PushManager');
        }

        const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawKey))));
        const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawAuth))));

        // 6. Register on server
        const regRes = await registerPushSubscriptionAction({
          endpoint: subscription.endpoint,
          p256dh,
          auth,
          userAgent: navigator.userAgent,
        });

        if (!regRes.success) {
          throw new Error(regRes.error || 'Failed to register subscription with server');
        }

        setIsSubscribed(true);
        setCurrentEndpoint(subscription.endpoint);
        setActiveDeviceCount((prev) => prev + 1);
        setActionSuccess('Browser notifications successfully enabled on this device!');
      } catch (err: any) {
        console.error('[PushSettings] Enable error:', err);
        setActionError(err.message || 'Failed to enable browser notifications.');
      }
    });
  }

  // Unsubscribe device
  async function handleDisablePush() {
    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          await subscription.unsubscribe();
          await removePushSubscriptionAction(subscription.endpoint);
        } else if (currentEndpoint) {
          await removePushSubscriptionAction(currentEndpoint);
        }

        setIsSubscribed(false);
        setCurrentEndpoint(null);
        setActiveDeviceCount((prev) => Math.max(0, prev - 1));
        setActionSuccess('Browser notifications disabled on this device.');
      } catch (err: any) {
        console.error('[PushSettings] Disable error:', err);
        setActionError(err.message || 'Failed to disable notifications.');
      }
    });
  }

  // Toggle global push preference
  async function handleTogglePushPreference(e: React.ChangeEvent<HTMLInputElement>) {
    const nextVal = e.target.checked;
    setBrowserPushEnabled(nextVal);

    startTransition(async () => {
      try {
        const res = await updatePushPreferenceAction(nextVal);
        if (!res.success) {
          setBrowserPushEnabled(!nextVal);
          setActionError(res.error || 'Failed to update notification preferences.');
        } else {
          setActionSuccess(nextVal ? 'Push notifications enabled.' : 'Push notifications muted across devices.');
        }
      } catch (err: any) {
        setBrowserPushEnabled(!nextVal);
        setActionError(err.message || 'Failed to update preferences.');
      }
    });
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-base">Browser Push Notifications</h3>
            <p className="text-xs text-muted-foreground">
              Receive instant alerts for bookings, payments, and attendance even when the tab is closed.
            </p>
          </div>
        </div>

        {/* Global Opt-in / Opt-out Toggle */}
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={browserPushEnabled}
            onChange={handleTogglePushPreference}
            disabled={isPending || isLoading}
          />
          <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>

      {/* Messages */}
      {actionError && (
        <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Status Details */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Support */}
        <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
          <span className="text-[11px] text-muted-foreground uppercase font-medium tracking-wider">Browser Support</span>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-medium">
            {isSupported ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Supported
              </span>
            ) : (
              <span className="text-amber-500 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" /> Unsupported
              </span>
            )}
          </div>
        </div>

        {/* Permission */}
        <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
          <span className="text-[11px] text-muted-foreground uppercase font-medium tracking-wider">OS Permission</span>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-medium">
            {permission === 'granted' && (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Granted
              </span>
            )}
            {permission === 'denied' && (
              <span className="text-red-500 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Blocked
              </span>
            )}
            {permission === 'default' && (
              <span className="text-muted-foreground flex items-center gap-1">
                <Info className="w-3.5 h-3.5" /> Not Requested
              </span>
            )}
          </div>
        </div>

        {/* Active Devices */}
        <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
          <span className="text-[11px] text-muted-foreground uppercase font-medium tracking-wider">Active Devices</span>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Smartphone className="w-3.5 h-3.5 text-primary" />
            <span>{activeDeviceCount} device{activeDeviceCount === 1 ? '' : 's'} registered</span>
          </div>
        </div>
      </div>

      {/* Permission Denied Guide */}
      {permission === 'denied' && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1.5">
          <div className="font-semibold flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            Notifications are blocked in your browser
          </div>
          <p>
            To enable notifications, click the tune/lock icon in your browser address bar, set{' '}
            <strong>Notifications</strong> to <strong>Allow</strong>, and refresh this page.
          </p>
        </div>
      )}

      {/* Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="text-xs text-muted-foreground">
          {isSubscribed ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> This device is actively subscribed to notifications.
            </span>
          ) : (
            <span>Enable notifications to receive background alerts on this device.</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isSubscribed ? (
            <button
              type="button"
              onClick={handleDisablePush}
              disabled={isPending || isLoading}
              className="px-3.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellOff className="w-3.5 h-3.5 text-muted-foreground" />}
              Disable on this Device
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEnablePush}
              disabled={isPending || isLoading || permission === 'denied' || isSupported === false}
              className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
              Enable on this Device
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
