'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, clearTokens, getToken, logoutRemote } from '../lib/api';
import { formatRelativeFa } from '../lib/dates';
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

const PRIMARY_NAV = [
  { href: '/work', label: 'کار امروز', hint: 'شروع' },
  { href: '/inbox', label: 'inbox', hint: 'اخبار' },
  { href: '/rundown', label: 'Today', hint: 'سبد' },
  { href: '/podcasts', label: 'پادکست', hint: 'ساخت' },
];

const MORE_LINKS = [
  { href: '/settings', label: 'تنظیمات', hint: 'تم، AI، ممیزی' },
  { href: '/waves', label: 'محتوا', hint: 'دلتای موج' },
  { href: '/sources', label: 'منابع خبر', hint: 'خزش و RSS' },
  { href: '/admin/clustering-evaluation', label: 'ارزیابی کلاستر', hint: 'ابزار کیفیت' },
  { href: '/dashboard', label: 'گزارش عملیات', hint: 'هزینه و صف' },
];

function IconSettings({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.86l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.86-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.86.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.86 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.86l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.86.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.86-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.86V9c0 .69.4 1.3 1 1.55H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" />
    </svg>
  );
}

function IconBell({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const hideChrome = pathname === '/login' || pathname === '/';
  const isDetail =
    /^\/inbox\/[^/]+$/.test(pathname) || /^\/podcasts\/[^/]+$/.test(pathname);
  const showBottomNav = !hideChrome && !isDetail;
  const moreActive = MORE_LINKS.some((l) => pathname.startsWith(l.href));

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
      setUnread((prev) => {
        if (nextUnread > prev && prev > 0) {
          const newest = nextItems.find((n) => !n.readAt);
          if (newest) {
            void showBrowserNotification(newest.title, {
              body: newest.body ?? undefined,
              href: newest.href ?? undefined,
            });
          }
        }
        return nextUnread;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (/unauthorized|jwt|token/i.test(message)) {
        clearTokens();
        setItems([]);
        setUnread(0);
        if (!hideChrome && pathname !== '/login') {
          router.replace('/login');
        }
      }
    }
  }, [hideChrome, pathname, router]);

  useEffect(() => {
    void registerServiceWorker();
  }, []);

  useEffect(() => {
    if (hideChrome) return;
    void refresh();
    const id = window.setInterval(() => {
      if (!getToken()) return;
      void refresh();
    }, 30000);
    return () => window.clearInterval(id);
  }, [refresh, hideChrome]);

  useEffect(() => {
    if (!open && !moreOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setMoreOpen(false);
      }
    }
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (open && panelRef.current && !panelRef.current.contains(t)) setOpen(false);
      if (moreOpen && moreRef.current && !moreRef.current.contains(t)) setMoreOpen(false);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open, moreOpen]);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

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

  async function onLogout() {
    await logoutRemote();
    router.replace('/login');
  }

  if (hideChrome) return <>{children}</>;

  return (
    <>
      <header className="fn-chrome sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <Link href="/work" className="font-display text-sm font-bold text-accent">
              اتاق خبر
            </Link>
            <p className="text-[10px] text-fog/45">inbox → Today → پادکست · قفل ۱۶:۰۰</p>
          </div>
          <div className="flex items-center gap-1.5">
            <Link
              href="/settings"
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition ${
                pathname.startsWith('/settings')
                  ? 'bg-accent/20 text-accent'
                  : 'text-fog/60 hover:bg-fog/10 hover:text-fog'
              }`}
              aria-label="تنظیمات"
              title="مرکز کنترل"
            >
              <IconSettings />
            </Link>
            <div className="relative" ref={panelRef}>
              <button
                type="button"
                onClick={() => {
                  setOpen((v) => !v);
                  setMoreOpen(false);
                }}
                className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full transition ${
                  open
                    ? 'bg-accent/20 text-accent'
                    : 'text-fog/60 hover:bg-fog/10 hover:text-fog'
                }`}
                aria-label="اعلان‌ها"
                title="اعلان‌ها"
                aria-expanded={open}
              >
                <IconBell />
                {unread > 0 ? (
                  <span className="absolute left-0.5 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-0.5 text-[8px] font-bold leading-none text-ink ring-2 ring-[rgb(var(--chrome))]">
                    {unread > 9 ? '۹+' : unread.toLocaleString('fa-IR')}
                  </span>
                ) : null}
              </button>
              {open ? (
                <div className="fn-panel absolute left-0 top-full z-50 mt-2 w-80 rounded-xl border p-2 shadow-lg">
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
                      <li className="px-2 py-6 text-center text-[11px] text-fog/45">
                        اعلانی نیست
                      </li>
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
                            <div className="mt-1 text-[10px] text-fog/35">
                              {formatRelativeFa(item.createdAt)}
                            </div>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void onLogout()}
              className="h-9 rounded-full px-3 text-[12px] text-fog/45 transition hover:bg-fog/10 hover:text-fog/80"
            >
              خروج
            </button>
          </div>
        </div>
      </header>

      <div className={showBottomNav ? 'pb-20' : undefined}>{children}</div>

      {showBottomNav ? (
        <nav
          className="fn-chrome fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur"
          aria-label="منوی اصلی"
        >
          <div className="mx-auto grid max-w-lg grid-cols-5">
            {PRIMARY_NAV.map((item) => {
              const active =
                item.href === '/work'
                  ? pathname === '/work'
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center gap-0.5 px-0.5 py-2.5 text-center transition-colors ${
                    active ? 'text-accent' : 'text-fog/55 hover:text-fog/80'
                  }`}
                >
                  <span className="text-[12px] font-semibold leading-none">{item.label}</span>
                  <span className="mt-0.5 text-[9px] leading-none opacity-65">{item.hint}</span>
                </Link>
              );
            })}
            <div className="relative" ref={moreRef}>
              <button
                type="button"
                onClick={() => {
                  setMoreOpen((v) => !v);
                  setOpen(false);
                }}
                className={`flex w-full flex-col items-center gap-0.5 px-1 py-2.5 text-center transition-colors ${
                  moreOpen || moreActive ? 'text-accent' : 'text-fog/55 hover:text-fog/80'
                }`}
                aria-expanded={moreOpen}
              >
                <span className="text-[13px] font-semibold leading-none">بیشتر</span>
                <span className="mt-0.5 text-[9px] leading-none opacity-65">ابزار</span>
              </button>
              {moreOpen ? (
                <div className="fn-panel absolute bottom-[calc(100%+0.35rem)] left-2 right-2 z-50 rounded-2xl border p-2 shadow-xl sm:left-auto sm:right-0 sm:w-56">
                  <p className="px-2 pb-1.5 text-[10px] text-fog/40">ابزارهای فنی</p>
                  <ul className="space-y-0.5">
                    {MORE_LINKS.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setMoreOpen(false)}
                          className={`block rounded-xl px-2.5 py-2.5 text-right ${
                            pathname.startsWith(item.href)
                              ? 'bg-accent/15 text-accent'
                              : 'text-fog/80 hover:bg-fog/5'
                          }`}
                        >
                          <div className="text-[12px] font-semibold">{item.label}</div>
                          <div className="text-[10px] text-fog/40">{item.hint}</div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </nav>
      ) : null}

      <InstallPrompt offsetClass={showBottomNav ? 'bottom-24' : 'bottom-4'} />
    </>
  );
}
