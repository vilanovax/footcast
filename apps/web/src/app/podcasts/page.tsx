'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, clearTokens, getToken } from '../../lib/api';
import { formatJalaliDate } from '../../lib/dates';
import {
  episodeStatusTone,
  labelEpisodeStatus,
  labelEventStatus,
} from '../../lib/labels';
import { StatusBadge } from '../../components/StatusBadge';
import { WorkflowGuide } from '../../components/WorkflowGuide';
import { EmptyState, PageHeader, SkeletonList } from '../../components/ui';

type Episode = {
  id: string;
  title: string;
  status: string;
  targetDurationMin: number;
  createdAt?: string;
};

type SelectedEvent = {
  id: string;
  title: string;
  status: string;
  importanceScore?: number | null;
  summary?: string | null;
};

export default function PodcastsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Episode[]>([]);
  const [selected, setSelected] = useState<SelectedEvent[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('خلاصه خبر فوتبال');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setLoading(true);
    try {
      const [eps, sel] = await Promise.all([
        apiFetch<Episode[]>('/podcasts?pageSize=40'),
        apiFetch<SelectedEvent[]>('/editorial/selected?pageSize=50'),
      ]);
      setItems(eps.data ?? []);
      const pool = sel.data ?? [];
      setSelected(pool);
      setPicked(new Set(pool.slice(0, 6).map((e) => e.id)));
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

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 6) next.add(id);
      return next;
    });
  }

  async function createEpisode() {
    if (picked.size === 0) {
      setError('حداقل یک خبر تأییدشده انتخاب کنید');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await apiFetch<Episode>('/podcasts', {
        method: 'POST',
        body: JSON.stringify({
          title,
          targetDurationMin: 10,
          eventIds: Array.from(picked),
        }),
      });
      router.push(`/podcasts/${res.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ساخت اپیزود ناموفق');
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 pb-28 pt-6" dir="rtl">
      <PageHeader
        eyebrow="گام ۲ — ساخت پادکست"
        title="پادکست‌ها"
        subtitle="خبرهای تأییدشده را انتخاب کنید، اپیزود بسازید، بعد متن → صدا → انتشار"
      />

      <WorkflowGuide
        activeOverride="podcast"
        counts={{ ready: selected.length, episodes: items.length }}
      />

      {error ? (
        <p className="mb-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? <SkeletonList rows={5} /> : null}

      {!loading ? (
        <section className="mb-6 rounded-2xl border border-fog/12 bg-black/20 p-4">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold text-fog">خبرهای تأییدشده</h2>
            <span className="text-[11px] text-fog/45">
              {selected.length.toLocaleString('fa-IR')} خبر · تا ۶ تا انتخاب
            </span>
          </div>

          {selected.length === 0 ? (
            <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-3 text-[12px] leading-6 text-amber-100/90">
              هنوز خبر تأییدشده‌ای نیست.{' '}
              <Link href="/inbox" className="font-semibold underline">
                برو به inbox
              </Link>{' '}
              و چند خبر را تأیید کن.
            </div>
          ) : (
            <>
              <label className="block text-xs text-fog/60">عنوان اپیزود</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-fog/15 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-accent/40"
              />

              <ul className="mt-3 max-h-72 space-y-2 overflow-auto">
                {selected.map((ev) => {
                  const on = picked.has(ev.id);
                  return (
                    <li key={ev.id}>
                      <button
                        type="button"
                        onClick={() => toggle(ev.id)}
                        className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2.5 text-right text-xs transition ${
                          on
                            ? 'border-accent/50 bg-accent/10'
                            : 'border-fog/10 bg-black/10 opacity-85'
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                            on
                              ? 'border-accent bg-accent text-ink'
                              : 'border-fog/30'
                          }`}
                        >
                          {on ? '✓' : ''}
                        </span>
                        <span className="flex-1">
                          <span className="font-medium leading-5 text-fog/90">
                            {ev.title}
                          </span>
                          <span className="mt-0.5 block text-fog/45">
                            {labelEventStatus(ev.status)}
                            {ev.importanceScore != null
                              ? ` · امتیاز ${ev.importanceScore.toLocaleString('fa-IR')}`
                              : ''}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <button
                type="button"
                disabled={creating || picked.size === 0}
                onClick={() => void createEpisode()}
                className="mt-4 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-ink disabled:opacity-50"
              >
                {creating
                  ? 'در حال ساخت…'
                  : `ساخت اپیزود از ${picked.size.toLocaleString('fa-IR')} خبر انتخاب‌شده`}
              </button>
            </>
          )}
        </section>
      ) : null}

      {!loading ? (
        <section>
          <h2 className="mb-3 text-sm font-bold text-fog">اپیزودهای شما</h2>
          {items.length === 0 ? (
            <EmptyState
              title="هنوز اپیزودی نیست"
              description="بالا چند خبر تأییدشده را تیک بزن و اپیزود بساز."
            />
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/podcasts/${item.id}`}
                    className="block rounded-xl border border-fog/10 bg-black/15 px-4 py-3 transition hover:border-accent/40"
                  >
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge
                        label={labelEpisodeStatus(item.status)}
                        tone={episodeStatusTone(item.status)}
                      />
                      <span className="text-[11px] text-fog/45">
                        هدف {item.targetDurationMin.toLocaleString('fa-IR')} دقیقه
                      </span>
                      {item.createdAt ? (
                        <span className="text-[11px] text-fog/40">
                          · {formatJalaliDate(item.createdAt)}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </main>
  );
}
