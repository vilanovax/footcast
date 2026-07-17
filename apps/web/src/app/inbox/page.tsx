'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, clearTokens, getToken } from '../../lib/api';

type InboxItem = {
  id: string;
  title: string;
  summary?: string | null;
  status: string;
  scope?: string | null;
  category?: string | null;
  officialStatus?: string | null;
  importanceScore?: number | null;
  articleCount?: number;
  latestScore?: { finalScore?: number; ruleHits?: string[] } | null;
};

export default function InboxPage() {
  const router = useRouter();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ pageSize: '40' });
      if (q.trim()) params.set('q', q.trim());
      if (status) params.set('status', status);
      const res = await apiFetch<InboxItem[]>(`/editorial/inbox?${params}`);
      setItems(res.data ?? []);
      setTotal(res.meta?.total ?? res.data?.length ?? 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'خطا';
      setError(message);
      if (/unauthorized|jwt|token/i.test(message)) {
        clearTokens();
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [q, status, router]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 pb-24 pt-6" dir="rtl">
      <header className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.2em] text-accent">INBOX</p>
          <h1 className="font-display text-2xl font-bold">صندوق ورودی</h1>
          <p className="text-xs text-fog/60">{total} رویداد برای بررسی</p>
        </div>
        <button
          type="button"
          onClick={() => {
            clearTokens();
            router.push('/login');
          }}
          className="text-xs text-fog/50 underline"
        >
          خروج
        </button>
      </header>

      <div className="mb-4 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جستجو..."
          className="flex-1 rounded-lg border border-fog/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-accent/50"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-fog/15 bg-black/20 px-2 py-2 text-sm"
        >
          <option value="">همه</option>
          <option value="NEEDS_REVIEW">نیاز به بررسی</option>
          <option value="NEW">جدید</option>
          <option value="CONFLICTED">تناقض</option>
          <option value="VERIFIED">تأیید اولیه</option>
        </select>
      </div>

      {loading ? <p className="text-sm text-fog/60">در حال بارگذاری...</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <ul className="space-y-3">
        {items.map((item) => {
          const score = item.latestScore?.finalScore ?? item.importanceScore ?? '—';
          return (
            <li key={item.id}>
              <Link
                href={`/inbox/${item.id}`}
                className="block rounded-xl border border-fog/10 bg-black/15 px-4 py-3 transition hover:border-accent/40 active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-[15px] font-semibold leading-snug">{item.title}</h2>
                  <span className="shrink-0 rounded-md bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent">
                    {score}
                  </span>
                </div>
                {item.summary ? (
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-fog/65">
                    {item.summary}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-fog/50">
                  <span>{item.status}</span>
                  {item.category ? <span>· {item.category}</span> : null}
                  {item.scope ? <span>· {item.scope}</span> : null}
                  {item.articleCount ? <span>· {item.articleCount} منبع</span> : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {!loading && items.length === 0 ? (
        <p className="mt-10 text-center text-sm text-fog/50">موردی در صف بررسی نیست.</p>
      ) : null}
    </main>
  );
}
