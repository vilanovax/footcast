'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, clearTokens, getToken } from '../../lib/api';
import { CoveragePanel } from '../../components/CoveragePanel';
import { WorkflowGuide } from '../../components/WorkflowGuide';
import { EmptyState, PageHeader, SkeletonList } from '../../components/ui';

type Wave = {
  id: string;
  label: string;
  status: string;
  editorialDate: string;
  startedAt?: string | null;
  sourcesChecked: number;
  articlesNew: number;
  eventsCreated: number;
  eventsUpdated: number;
  failedSources: number;
};

type Observation = {
  id: string;
  observationType: string;
  summary?: string | null;
  significanceScore?: number | null;
  isSeenByEditor: boolean;
  detectedAt: string;
  newsEventId: string;
  event?: {
    id: string;
    title: string;
    status: string;
    scope?: string | null;
    effectiveFinalScore?: number | null;
  } | null;
};

type Counts = {
  unseen: number;
  new: number;
  developments: number;
  confirmations: number;
  conflicts: number;
  all: number;
};

const TABS: Array<{ id: string; label: string }> = [
  { id: 'unseen', label: 'نادیده' },
  { id: 'new', label: 'جدید' },
  { id: 'developments', label: 'تحولات' },
  { id: 'confirmations', label: 'تأییدها' },
  { id: 'conflicts', label: 'تناقض' },
  { id: 'all', label: 'همه' },
];

const OBS_LABEL: Record<string, string> = {
  NEW_EVENT: 'رویداد جدید',
  NEW_DEVELOPMENT: 'تحول مهم',
  OFFICIAL_CONFIRMATION: 'تأیید رسمی',
  NEW_SOURCE: 'منبع جدید',
  CONFLICT_DETECTED: 'تناقض',
  SCORE_CHANGED: 'تغییر امتیاز',
};

export default function WavesPage() {
  const router = useRouter();
  const [waves, setWaves] = useState<Wave[]>([]);
  const [waveId, setWaveId] = useState<string | null>(null);
  const [tab, setTab] = useState('unseen');
  const [items, setItems] = useState<Observation[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [crawling, setCrawling] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [coverageFilterIds, setCoverageFilterIds] = useState<string[] | null>(
    null,
  );
  const [coverageFilterLabel, setCoverageFilterLabel] = useState<string | null>(
    null,
  );

  const loadWaves = useCallback(async () => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    try {
      let res = await apiFetch<Wave[]>('/waves');
      let list = res.data ?? [];
      if (list.length === 0) {
        await apiFetch<Wave>('/waves/open', { method: 'POST', body: '{}' });
        res = await apiFetch<Wave[]>('/waves');
        list = res.data ?? [];
      }
      setWaves(list);
      const id = list[0]?.id ?? null;
      setWaveId((prev) => prev ?? id);
      if (id) {
        const bf = await apiFetch<{
          observationsCreated: number;
          openEvents: number;
        }>('/waves/backfill', {
          method: 'POST',
          body: JSON.stringify({ waveId: id }),
        });
        if ((bf.data?.observationsCreated ?? 0) > 0) {
          setInfo(
            `${bf.data.observationsCreated.toLocaleString('fa-IR')} خبر باز از inbox به محتوا منتقل شد`,
          );
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'خطا';
      setError(message);
      if (/unauthorized|jwt|token/i.test(message)) {
        clearTokens();
        router.replace('/login');
      }
    }
  }, [router]);

  const loadInbox = useCallback(async () => {
    if (!waveId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<Observation[]>(
        `/waves/${waveId}/inbox?tab=${tab}`,
      );
      setItems(res.data ?? []);
      const meta = res.meta as unknown as { counts?: Counts } | null;
      setCounts(meta?.counts ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setLoading(false);
    }
  }, [waveId, tab]);

  useEffect(() => {
    void loadWaves();
  }, [loadWaves]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  async function crawlNow() {
    setCrawling(true);
    setError(null);
    try {
      // close current wave stats then open fresh for new crawl batch
      if (waveId) {
        try {
          await apiFetch(`/waves/${waveId}/complete`, {
            method: 'POST',
            body: '{}',
          });
        } catch {
          /* ignore if already completed */
        }
      }
      await apiFetch('/waves/open', { method: 'POST', body: '{}' });
      const crawl = await apiFetch<{ queued: number; totalSources: number }>(
        '/sources/crawl-all',
        { method: 'POST', body: '{}' },
      );
      setInfo(
        `جستجو شروع شد — ${crawl.data.queued.toLocaleString('fa-IR')} منبع در صف. خبرهای جدید همین‌جا می‌آیند.`,
      );
      await loadWaves();
      window.setTimeout(() => void loadInbox(), 10000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خزش ناموفق');
    } finally {
      setCrawling(false);
    }
  }

  async function addToRundown(eventId: string) {
    setBusy(eventId);
    setError(null);
    try {
      await apiFetch('/rundown/today/items', {
        method: 'POST',
        body: JSON.stringify({ eventId }),
      });
      await apiFetch('/waves/observations/mark-seen', {
        method: 'POST',
        body: JSON.stringify({
          ids: items.filter((i) => i.newsEventId === eventId).map((i) => i.id),
        }),
      });
      await loadInbox();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'افزودن ناموفق');
    } finally {
      setBusy(null);
    }
  }

  async function markSeen(id: string) {
    setBusy(id);
    try {
      await apiFetch('/waves/observations/mark-seen', {
        method: 'POST',
        body: JSON.stringify({ ids: [id] }),
      });
      await loadInbox();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(null);
    }
  }

  const activeWave = waves.find((w) => w.id === waveId);
  const visibleItems = coverageFilterIds
    ? items.filter((i) => coverageFilterIds.includes(i.newsEventId))
    : items;

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 pb-28 pt-6" dir="rtl">
      <PageHeader
        eyebrow="دلتای موج"
        title="محتوا"
        subtitle="فقط خبر/تحول تازهٔ همان موج — لیست کامل در inbox"
        action={
          <button
            type="button"
            disabled={crawling}
            onClick={() => void crawlNow()}
            className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
          >
            {crawling ? 'در حال جستجو…' : 'جستجوی خبر الان'}
          </button>
        }
      />

      <WorkflowGuide
        activeOverride="review"
        counts={{ review: counts?.unseen ?? 0 }}
      />

      <div className="mb-3 flex gap-2">
        <Link
          href="/inbox"
          className="flex-1 rounded-xl border border-accent/35 bg-accent/10 py-2.5 text-center text-xs font-semibold text-accent"
        >
          inbox
        </Link>
        <Link
          href="/rundown"
          className="rounded-xl border border-fog/15 px-3 py-2.5 text-xs text-fog/70"
        >
          Today
        </Link>
      </div>

      {info ? (
        <p className="mb-3 rounded-xl border border-accent/25 bg-accent/10 px-3 py-2 text-[11px] leading-5 text-accent">
          {info}
        </p>
      ) : null}

      {activeWave ? (
        <div className="mb-4 rounded-2xl border border-fog/12 bg-black/20 px-3 py-3 text-[11px] leading-6 text-fog/70">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <select
              value={waveId ?? ''}
              onChange={(e) => setWaveId(e.target.value)}
              className="rounded-lg border border-fog/15 bg-black/30 px-2 py-1.5 text-xs text-fog"
            >
              {waves.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label} · {w.status}
                </option>
              ))}
            </select>
          </div>
          <p>
            {activeWave.eventsCreated.toLocaleString('fa-IR')} رویداد ·{' '}
            {activeWave.eventsUpdated.toLocaleString('fa-IR')} تحول ·{' '}
            {activeWave.articlesNew.toLocaleString('fa-IR')} مقاله
          </p>
        </div>
      ) : null}

      <CoveragePanel
        onFilter={(dimension, key, eventIds) => {
          setCoverageFilterIds(eventIds);
          setCoverageFilterLabel(`${dimension}:${key}`);
          setTab('all');
        }}
      />

      {coverageFilterIds ? (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-accent/25 bg-accent/10 px-3 py-2 text-[11px] text-accent">
          <span>
            فیلتر پوشش {coverageFilterLabel} ·{' '}
            {coverageFilterIds.length.toLocaleString('fa-IR')} خبر
          </span>
          <button
            type="button"
            className="underline"
            onClick={() => {
              setCoverageFilterIds(null);
              setCoverageFilterLabel(null);
            }}
          >
            پاک کردن
          </button>
        </div>
      ) : null}

      <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const n =
            t.id === 'unseen'
              ? counts?.unseen
              : t.id === 'new'
                ? counts?.new
                : t.id === 'developments'
                  ? counts?.developments
                  : t.id === 'confirmations'
                    ? counts?.confirmations
                    : t.id === 'conflicts'
                      ? counts?.conflicts
                      : counts?.all;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] ${
                tab === t.id
                  ? 'bg-accent/20 text-accent ring-1 ring-accent/40'
                  : 'bg-black/20 text-fog/60'
              }`}
            >
              {t.label}
              {n != null ? ` ${n.toLocaleString('fa-IR')}` : ''}
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="mb-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? <SkeletonList rows={5} /> : null}

      {!loading && visibleItems.length === 0 ? (
        <EmptyState
          title={coverageFilterIds ? 'در این فیلتر خبری نیست' : 'دلتای جدیدی نیست'}
          description={
            coverageFilterIds
              ? 'فیلتر پوشش را پاک کن یا دستهٔ دیگری را انتخاب کن.'
              : 'خبرهای قبلی در inbox هستند. برای خبر تازه دکمهٔ «جستجوی خبر الان» را بزن.'
          }
          action={
            <div className="flex flex-col items-center gap-2">
              {coverageFilterIds ? (
                <button
                  type="button"
                  onClick={() => {
                    setCoverageFilterIds(null);
                    setCoverageFilterLabel(null);
                  }}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-ink"
                >
                  پاک کردن فیلتر
                </button>
              ) : (
                <button
                  type="button"
                  disabled={crawling}
                  onClick={() => void crawlNow()}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
                >
                  {crawling ? 'در حال جستجو…' : 'جستجوی خبر الان'}
                </button>
              )}
              <Link href="/inbox" className="text-xs text-accent underline">
                برو به inbox
              </Link>
            </div>
          }
        />
      ) : null}

      {!loading && visibleItems.length > 0 ? (
        <ul className="space-y-3">
          {visibleItems.map((obs) => (
            <li
              key={obs.id}
              className="rounded-xl border border-fog/10 bg-black/15 px-3 py-3"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] text-fog/45">
                <span className="rounded bg-fog/10 px-1.5 py-0.5 text-fog/70">
                  {OBS_LABEL[obs.observationType] ?? obs.observationType}
                </span>
                {obs.event?.scope ? <span>{obs.event.scope}</span> : null}
                {obs.event?.effectiveFinalScore != null ? (
                  <span>
                    امتیاز {obs.event.effectiveFinalScore.toLocaleString('fa-IR')}
                  </span>
                ) : null}
              </div>
              <Link
                href={`/inbox/${obs.newsEventId}`}
                className="text-sm font-semibold leading-6 text-fog hover:text-accent"
              >
                {obs.event?.title ?? obs.summary ?? 'بدون عنوان'}
              </Link>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy === obs.newsEventId}
                  onClick={() => void addToRundown(obs.newsEventId)}
                  title="افزودن به Today"
                  aria-label="افزودن به Today"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-lg font-bold leading-none text-ink disabled:opacity-50"
                >
                  +
                </button>
                <button
                  type="button"
                  disabled={busy === obs.id}
                  onClick={() => void markSeen(obs.id)}
                  className="rounded-lg border border-fog/15 px-3 py-1.5 text-[11px] text-fog/70"
                >
                  دیدم
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
