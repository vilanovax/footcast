'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch, clearTokens, getToken } from '../lib/api';
import { InstallPrompt } from './InstallPrompt';
import { registerServiceWorker, showBrowserNotification } from '../lib/pwa';

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
  readAt?: string | null;
  createdAt?: string;
};

const NAV = [
  { href: '/dashboard', label: 'داشبورد' },
  { href: '/inbox', label: 'صندوق' },
  { href: '/podcasts', label: 'پادکست' },
];

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const hideChrome = pathname === '/login' || pathname === '/';

  const refresh = useCallback(async () => {
    if (!getToken() || hideChrome) return;
    try {
      const [list, count] = await Promise.all([
        apiFetch<NotificationItem[]>('/notifications?pageSize=12'),
        apiFetch<{ unread: number }>('/notifications/unread-count'),
      ]);
      const nextItems = Array.isArray(list.data) ? list.data : [];
      setItems(nextItems);
      const nextUnread = count.data?.unread ?? 0;
      if (nextUnread > unread && unread > 0) {
        const newest = nextItems.find((n) => !n.readAt);
        if (newest) {
          void showBrowserNotification(newest.title, {
            body: newest.body ?? undefined,
            href: newest.href ?? undefined,
          });
        }
      }
      setUnread(nextUnread);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (/unauthorized|jwt|token/i.test(message)) {
        clearTokens();
      }
    }
  }, [hideChrome, unread]);

  useEffect(() => {
    void registerServiceWorker();
  }, []);

  useEffect(() => {
    void refresh();
    if (hideChrome) return;
    const id = window.setInterval(() => void refresh(), 20000);
    return () => window.clearInterval(id);
  }, [refresh, hideChrome]);

  async function markAll() {
    try {
      await apiFetch('/notifications/read-all', { method: 'POST', body: '{}' });
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    } catch {
      /* ignore */
    }
  }

  async function openItem(item: NotificationItem) {
    try {
      if (!item.readAt) {
        await apiFetch(`/notifications/${item.id}/read`, { method: 'POST', body: '{}' });
        setUnread((n) => Math.max(0, n - 1));
      }
    } catch {
      /* ignore */
    }
    setOpen(false);
    if (item.href) router.push(item.href);
  }

  if (hideChrome) return <>{children}</>;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-fog/10 bg-[#0a2f24]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/dashboard" className="font-display text-sm font-bold text-accent">
            اتاق خبر
          </Link>
          <nav className="flex items-center gap-1 text-xs">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-2.5 py-1.5 ${
                  pathname.startsWith(item.href)
                    ? 'bg-accent/20 text-accent'
                    : 'text-fog/70 hover:bg-white/5'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="relative rounded-lg border border-fog/20 px-2.5 py-1.5 text-fog/80"
                aria-label="اعلان‌ها"
              >
                اعلان
                {unread > 0 ? (
                  <span className="absolute -left-1 -top-1 min-w-4 rounded-full bg-accent px-1 text-[10px] font-bold text-ink">
                    {unread > 9 ? '۹+' : unread}
                  </span>
                ) : null}
              </button>
              {open ? (
                <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-fog/15 bg-[#0d3428] p-2 shadow-xl">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="text-[11px] text-fog/50">اعلان‌ها</span>
                    <button
                      type="button"
                      onClick={() => void markAll()}
                      className="text-[11px] text-accent"
                    >
                      همه خوانده
                    </button>
                  </div>
                  <ul className="max-h-80 space-y-1 overflow-auto">
                    {items.length === 0 ? (
                      <li className="px-2 py-4 text-center text-[11px] text-fog/45">موردی نیست</li>
                    ) : (
                      items.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => void openItem(item)}
                            className={`w-full rounded-lg px-2 py-2 text-right text-xs ${
                              item.readAt ? 'text-fog/55' : 'bg-black/20 text-fog/90'
                            }`}
                          >
                            <div className="font-semibold">{item.title}</div>
                            {item.body ? (
                              <div className="mt-0.5 line-clamp-2 text-[11px] text-fog/45">
                                {item.body}
                              </div>
                            ) : null}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              ) : null}
            </div>
          </nav>
        </div>
      </header>
      {children}
      <InstallPrompt />
    </>
  );
}
