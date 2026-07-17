'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, clearTokens, getToken } from '../../lib/api';

type Episode = {
  id: string;
  title: string;
  status: string;
  targetDurationMin: number;
  createdAt?: string;
};

export default function PodcastsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Episode[]>([]);
  const [title, setTitle] = useState('خلاصه خبر فوتبال');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<Episode[]>('/podcasts?pageSize=40');
      setItems(res.data ?? []);
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
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createEpisode() {
    setError(null);
    try {
      const selected = await apiFetch<Array<{ id: string }>>('/editorial/selected?pageSize=10');
      const eventIds = (selected.data ?? []).map((e) => e.id);
      const res = await apiFetch<Episode>('/podcasts', {
        method: 'POST',
        body: JSON.stringify({
          title,
          targetDurationMin: 10,
          eventIds: eventIds.slice(0, 6),
        }),
      });
      router.push(`/podcasts/${res.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ساخت اپیزود ناموفق');
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 pb-20 pt-6" dir="rtl">
      <header className="mb-5 flex items-end justify-between">
        <div>
          <p className="text-[11px] tracking-[0.2em] text-accent">PODCAST</p>
          <h1 className="font-display text-2xl font-bold">اپیزودها</h1>
        </div>
        <Link href="/inbox" className="text-xs text-fog/55 underline">
          صندوق ورودی
        </Link>
      </header>

      <div className="mb-6 rounded-xl border border-fog/15 bg-black/15 p-3">
        <label className="block text-xs text-fog/60">عنوان اپیزود جدید</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-lg border border-fog/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-accent/40"
        />
        <button
          type="button"
          onClick={() => void createEpisode()}
          className="mt-3 w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-ink"
        >
          ساخت از اخبار تأییدشده
        </button>
        <p className="mt-2 text-[11px] text-fog/45">
          حداکثر ۶ خبر APPROVED/SELECTED به‌صورت خودکار اضافه می‌شود.
        </p>
      </div>

      {loading ? <p className="text-sm text-fog/60">بارگذاری...</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/podcasts/${item.id}`}
              className="block rounded-xl border border-fog/10 bg-black/15 px-4 py-3 transition hover:border-accent/40"
            >
              <h2 className="text-sm font-semibold">{item.title}</h2>
              <p className="mt-1 text-[11px] text-fog/50">
                {item.status} · هدف {item.targetDurationMin} دقیقه
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
