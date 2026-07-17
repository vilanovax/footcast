export async function registerServiceWorker(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    /* ignore offline register failures in dev */
  }
}

export async function ensureNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  return Notification.requestPermission();
}

export async function showBrowserNotification(
  title: string,
  opts?: { body?: string; href?: string },
): Promise<void> {
  const permission = await ensureNotificationPermission();
  if (permission !== 'granted') return;
  const reg = await navigator.serviceWorker.getRegistration();
  const payload = {
    body: opts?.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { href: opts?.href ?? '/' },
  };
  if (reg?.showNotification) {
    await reg.showNotification(title, payload);
    return;
  }
  new Notification(title, payload);
}
