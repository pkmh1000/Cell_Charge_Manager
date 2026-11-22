import { useCallback, useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

export const APP_VERSION = '0.9.0-beta.1';
export const APP_CHANNEL = 'Beta';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export type UpdateCheckState =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'update-available'
  | 'offline'
  | 'error';

export interface RemoteVersionInfo {
  version: string;
  channel: string;
  releasedAt: string;
  notes: string;
}

export function useBetaUpdater() {
  const [swWaiting, setSwWaiting] = useState(false);
  const [checkState, setCheckState] = useState<UpdateCheckState>('idle');
  const [remoteVersion, setRemoteVersion] = useState<RemoteVersionInfo | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    // Register service worker in manual prompt mode: never force-reload or auto-notify
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        setSwWaiting(true);
      },
      onRegisteredSW(_swUrl, registration) {
        registrationRef.current = registration;
      },
      onRegisterError() {
        // Silent in preview / unsupported contexts
      },
    });
    updateSWRef.current = updateSW;
  }, []);

  const checkForUpdates = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setCheckState('offline');
      return;
    }

    setCheckState('checking');
    try {
      let hasNewSW = swWaiting;

      if (registrationRef.current) {
        await registrationRef.current.update();
        if (registrationRef.current.waiting) {
          hasNewSW = true;
          setSwWaiting(true);
        }
      }

      const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const info = (await res.json()) as RemoteVersionInfo;
        setRemoteVersion(info);
        if (info.version && info.version !== APP_VERSION) {
          hasNewSW = true;
        }
      }

      setLastCheckedAt(
        new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
      );
      setCheckState(hasNewSW ? 'update-available' : 'up-to-date');
    } catch {
      setCheckState('error');
    }
  }, [swWaiting]);

  const installUpdate = useCallback(async () => {
    if (updateSWRef.current && swWaiting) {
      await updateSWRef.current(true);
    } else {
      window.location.reload();
    }
  }, [swWaiting]);

  return {
    currentVersion: APP_VERSION,
    channel: APP_CHANNEL,
    swWaiting,
    checkState,
    remoteVersion,
    lastCheckedAt,
    checkForUpdates,
    installUpdate,
  };
}
