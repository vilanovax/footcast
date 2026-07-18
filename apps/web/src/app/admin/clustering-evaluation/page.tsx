'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, clearTokens, getToken } from '../../../lib/api';
import { formatJalali } from '../../../lib/dates';
import { StatusBadge } from '../../../components/StatusBadge';

type QueueItem = {
  decisionLog: {
    id: string;
    rawArticleId: string;
    selectedEventId?: string | null;
    decision: string;
    relationship?: string | null;
    finalSimilarity?: number | null;
    reason?: string | null;
    aiUsed?: boolean;
    thresholdPolicyVersion?: string;
    similarityBreakdown?: Record<string, unknown> | null;
    candidateSnapshot?: Array<{ eventId: string; score: number }> | null;
  };
  article: {
    id: string;
    title?: string | null;
    canonicalUrl?: string | null;
    publishedAt?: string | null;
    source?: { id: string; name: string } | null;
  } | null;
};

type ReviewItem = {
  article: Record<string, unknown>;
  extraction: {
    headlineFa?: string | null;
    summaryFa?: string | null;
    category?: string | null;
    cardJson?: Record<string, unknown> | null;
  } | null;
  decisionLog: QueueItem['decisionLog'] | null;
  event: {
    id: string;
    title: string;
    summary?: string | null;
    category?: string | null;
    timelineItems?: Array<{ id: string; summary: string; action?: string | null }>;
    articles?: Array<{
      role?: string;
      article?: { id?: string; title?: string; source?: { name?: string } };
    }>;
  } | null;
  link: Record<string, unknown> | null;
  evaluations: Array<Record<string, unknown>>;
  policyVersion: string;
};

type Metrics = {
  evaluatedCount: number;
  policyVersion: string;
  falseMergeRate: number;
  missedMergeRate: number;
  exactDuplicateRecall: number | null;
  sameEventRecall: number | null;
};

type EventHit = { id: string; title: string; category?: string | null };

const PRIMARY_VERDICTS = [
  {
    verdict: 'CORRECT',
    expected: 'SAME_EVENT',
    label: 'درست است',
    hint: 'تصمیم موتور قابل قبول',
    tone: 'ok' as const,
  },
  {
    verdict: 'WRONG_MERGE',
    expected: 'UNRELATED',
    label: 'باید Event جدید',
    hint: 'ادغام اشتباه (False Merge)',
    tone: 'danger' as const,
  },
  {
    verdict: 'MISSED_MERGE',
    expected: 'SAME_EVENT',
    label: 'باید ادغام شود',
    hint: 'Event دیگر را پایین انتخاب کنید',
    tone: 'warn' as const,
  },
] as const;

const RELATION_VERDICTS = [
  { verdict: 'WRONG_RELATIONSHIP', expected: 'EXACT_DUPLICATE', label: 'Exact Dup' },
  { verdict: 'WRONG_RELATIONSHIP', expected: 'NEAR_DUPLICATE', label: 'Near Dup' },
  { verdict: 'WRONG_RELATIONSHIP', expected: 'SAME_EVENT', label: 'Same Event' },
  { verdict: 'WRONG_RELATIONSHIP', expected: 'NEW_DEVELOPMENT', label: 'New Dev' },
  { verdict: 'WRONG_RELATIONSHIP', expected: 'RELATED_BUT_DIFFERENT', label: 'Related' },
  { verdict: 'UNCERTAIN', expected: 'UNRELATED', label: 'نامشخص' },
] as const;

const DECISION_FA: Record<string, string> = {
  create: 'Event جدید',
  attach: 'پیوست به Event',
  conflict: 'نیاز به بررسی',
  skip: 'رد شده',
};

const REASON_FA: Record<string, string> = {
  no_shared_primary_entity: 'موجودیت اصلی مشترک نیست',
  no_candidates: 'نامزدی پیدا نشد',
  exact_duplicate: 'تکرار دقیق',
  near_duplicate: 'نزدیک به تکراری',
  below_ai_boundary: 'زیر آستانه مرزی',
  related_but_different: 'مرتبط اما رویداد جدا',
  ai_boundary_disabled_prefer_create: 'AI خاموش — ترجیح ایجاد جدید',
  ai_failure_prefer_create: 'خطای AI — ایجاد جدید',
  backfill_from_news_event_article: 'از لینک قبلی (backfill)',
};

const BREAKDOWN_FA: Record<string, string> = {
  eventSimilarity: 'شباهت کل',
  entitySimilarity: 'موجودیت',
  eventTypeSimilarity: 'نوع رویداد',
  actionCompatibility: 'اکشن',
  semanticSimilarity: 'معنایی',
  titleSimilarity: 'عنوان',
  timeSimilarity: 'زمان',
  sameMatchId: 'همان بازی',
  withinCategoryWindow: 'پنجرهٔ دسته',
};

function reasonLabel(reason?: string | null): string {
  if (!reason) return '—';
  const key = reason.split(':')[0] ?? reason;
  return REASON_FA[key] ?? reason;
}

function pct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  return `${Math.round(v * 100)}٪`;
}

function scoreTone(score: number | null | undefined): string {
  if (score == null) return 'text-fog/50';
  if (score >= 0.9) return 'text-emerald-300';
  if (score >= 0.74) return 'text-amber-200';
  return 'text-fog/80';
}

export default function ClusteringEvaluationPage() {
  const router = useRouter();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [expectedEventId, setExpectedEventId] = useState<string | null>(null);
  const [eventQuery, setEventQuery] = useState('');
  const [eventHits, setEventHits] = useState<EventHit[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [techOpen, setTechOpen] = useState(false);
  const [relOpen, setRelOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const queueIndex = useMemo(
    () => queue.findIndex((q) => q.decisionLog.rawArticleId === currentId),
    [queue, currentId],
  );

  const loadQueue = useCallback(async () => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setLoading(true);
    try {
      const [q, m] = await Promise.all([
        apiFetch<QueueItem[]>('/clustering/queue?pageSize=40'),
        apiFetch<Metrics>('/clustering/metrics'),
      ]);
      const items = Array.isArray(q.data) ? q.data : [];
      setQueue(items);
      setMetrics(m.data);
      setCurrentId((prev) => {
        if (prev && items.some((i) => i.decisionLog.rawArticleId === prev)) return prev;
        return items[0]?.decisionLog.rawArticleId ?? null;
      });
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

  const loadReview = useCallback(async (id: string) => {
    try {
      const res = await apiFetch<ReviewItem>(`/clustering/articles/${id}/review`);
      setReview(res.data);
      setExpectedEventId(null);
      setNote('');
      setEventQuery('');
      setRelOpen(false);
      setTechOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در بارگذاری');
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (currentId) void loadReview(currentId);
  }, [currentId, loadReview]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 3200);
    return () => window.clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (!eventQuery.trim()) {
      setEventHits([]);
      return;
    }
    const t = setTimeout(() => {
      void apiFetch<EventHit[]>(
        `/clustering/events/search?q=${encodeURIComponent(eventQuery)}&limit=12`,
      ).then((res) => setEventHits(Array.isArray(res.data) ? res.data : []));
    }, 250);
    return () => clearTimeout(t);
  }, [eventQuery]);

  function goRelative(delta: number) {
    if (queue.length === 0) return;
    const idx = queueIndex < 0 ? 0 : queueIndex;
    const next = queue[idx + delta];
    if (next) setCurrentId(next.decisionLog.rawArticleId);
  }

  async function submit(verdict: string, expectedRelationship: string) {
    if (!currentId) return;
    if (verdict === 'MISSED_MERGE' && !expectedEventId) {
      setError('برای «باید ادغام شود» ابتدا Event صحیح را جست‌وجو و انتخاب کنید.');
      setRelOpen(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/clustering/evaluations', {
        method: 'POST',
        body: JSON.stringify({
          rawArticleId: currentId,
          verdict,
          expectedRelationship,
          expectedEventId: expectedEventId || undefined,
          note: note.trim() || undefined,
        }),
      });
      setFlash('ذخیره شد — مورد بعدی');
      const idx = queue.findIndex((q) => q.decisionLog.rawArticleId === currentId);
      const next = queue[idx + 1] ?? queue.filter((q) => q.decisionLog.rawArticleId !== currentId)[0];
      await loadQueue();
      if (next) setCurrentId(next.decisionLog.rawArticleId);
      else {
        setCurrentId(null);
        setReview(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ذخیره');
    } finally {
      setBusy(false);
    }
  }

  async function backfill() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ created: number }>(
        '/clustering/backfill-decision-logs?limit=500',
        { method: 'POST', body: '{}' },
      );
      setFlash(`${(res.data?.created ?? 0).toLocaleString('fa-IR')} مورد به صف اضافه شد`);
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در backfill');
    } finally {
      setBusy(false);
    }
  }

  const log = review?.decisionLog;
  const breakdown = (log?.similarityBreakdown ?? null) as Record<
    string,
    number | string | boolean
  > | null;
  const similarity = log?.finalSimilarity ?? null;
  const similarityPct = similarity != null ? Math.round(similarity * 100) : null;

  const barKeys = [
    'eventSimilarity',
    'entitySimilarity',
    'eventTypeSimilarity',
    'actionCompatibility',
    'semanticSimilarity',
    'titleSimilarity',
    'timeSimilarity',
  ] as const;

  return (
    <main
      className={`mx-auto min-h-dvh max-w-3xl px-4 pt-4 ${
        review ? 'pb-[calc(9.5rem+env(safe-area-inset-bottom))]' : 'pb-24'
      }`}
      dir="rtl"
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-accent">ابزار کیفیت موتور</p>
          <h1 className="font-display text-xl font-bold text-fog">ارزیابی Clustering</h1>
          <p className="mt-1 text-[11px] text-fog/50">
            Policy {metrics?.policyVersion ?? '—'} · ثبت‌شده{' '}
            {(metrics?.evaluatedCount ?? 0).toLocaleString('fa-IR')}
            {queue.length > 0 ? (
              <>
                {' '}
                · صف {queue.length.toLocaleString('fa-IR')}
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Link
            href="/inbox"
            className="rounded-lg border border-fog/15 px-2.5 py-1.5 text-[11px] text-fog/70"
          >
            صندوق
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => void backfill()}
            className="text-[10px] text-fog/40 underline disabled:opacity-40"
          >
            پر کردن صف از دادهٔ قدیمی
          </button>
        </div>
      </header>

      {metrics ? (
        <section className="mb-4 grid grid-cols-4 gap-1.5">
          <MetricChip
            label="ادغام غلط"
            value={pct(metrics.falseMergeRate)}
            danger={(metrics.falseMergeRate ?? 0) > 0.03}
          />
          <MetricChip label="از‌دست‌رفته" value={pct(metrics.missedMergeRate)} />
          <MetricChip label="Same Event" value={pct(metrics.sameEventRecall)} />
          <MetricChip label="Exact Dup" value={pct(metrics.exactDuplicateRecall)} />
        </section>
      ) : null}

      {/* Progress */}
      {queue.length > 0 ? (
        <div className="mb-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/30">
            <div
              className="h-full rounded-full bg-accent/80 transition-all duration-300"
              style={{
                width: `${Math.max(
                  4,
                  ((metrics?.evaluatedCount ?? 0) /
                    Math.max(1, (metrics?.evaluatedCount ?? 0) + queue.length)) *
                    100,
                )}%`,
              }}
            />
          </div>
          <span className="shrink-0 text-[10px] tabular-nums text-fog/40">
            {queueIndex >= 0 ? queueIndex + 1 : 0}/{queue.length}
          </span>
        </div>
      ) : null}

      {flash ? (
        <p
          role="status"
          className="fn-fade-in mb-3 rounded-xl border border-accent/30 bg-accent/12 px-3 py-2 text-xs text-accent"
        >
          {flash}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mb-3 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200"
        >
          {error}
        </p>
      ) : null}

      {/* Mobile queue toggle */}
      <div className="mb-3 lg:hidden">
        <button
          type="button"
          onClick={() => setQueueOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-fog/12 bg-black/25 px-3 py-2.5 text-xs text-fog/75"
        >
          <span>
            صف بررسی
            {queueIndex >= 0
              ? ` · مورد ${(queueIndex + 1).toLocaleString('fa-IR')}`
              : ''}
          </span>
          <span className="text-fog/40">{queueOpen ? 'بستن' : 'باز کردن'}</span>
        </button>
        {queueOpen ? (
          <QueueList
            queue={queue}
            currentId={currentId}
            onSelect={(id) => {
              setCurrentId(id);
              setQueueOpen(false);
            }}
            className="fn-fade-in mt-2 max-h-56"
          />
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
        <aside className="hidden lg:block">
          <QueueList queue={queue} currentId={currentId} onSelect={setCurrentId} />
        </aside>

        <section className="min-w-0 space-y-3">
          {loading && !review ? (
            <div className="animate-pulse space-y-3 rounded-2xl border border-fog/10 bg-black/15 p-4">
              <div className="h-4 w-1/3 rounded bg-fog/10" />
              <div className="h-6 w-4/5 rounded bg-fog/10" />
              <div className="h-16 w-full rounded bg-fog/5" />
            </div>
          ) : null}

          {!loading && !review ? (
            <div className="rounded-2xl border border-dashed border-fog/20 bg-black/10 px-4 py-10 text-center">
              <p className="text-sm text-fog/70">صف ارزیابی خالی است</p>
              <p className="mt-1 text-xs text-fog/40">
                Backfill بزنید یا صبر کنید clustering جدید Decision Log بسازد.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void backfill()}
                className="mt-4 rounded-xl bg-accent/90 px-4 py-2 text-xs font-semibold text-ink disabled:opacity-40"
              >
                پر کردن صف
              </button>
            </div>
          ) : null}

          {review ? (
            <>
              {/* Decision summary */}
              <div className="fn-fade-in overflow-hidden rounded-2xl border border-fog/10 bg-black/20">
                <div className="flex items-stretch gap-0">
                  <div className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center border-e border-fog/10 bg-black/25 px-2 py-4">
                    <span className={`text-2xl font-bold tabular-nums ${scoreTone(similarity)}`}>
                      {similarityPct != null ? similarityPct : '—'}
                    </span>
                    <span className="mt-0.5 text-[10px] text-fog/40">٪ شباهت</span>
                  </div>
                  <div className="min-w-0 flex-1 px-3.5 py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      <StatusBadge
                        label={DECISION_FA[log?.decision ?? ''] ?? log?.decision ?? '—'}
                        tone="accent"
                      />
                      {log?.relationship ? (
                        <StatusBadge label={log.relationship} tone="ok" />
                      ) : null}
                      {log?.aiUsed ? <StatusBadge label="AI" tone="warn" /> : null}
                    </div>
                    <h2 className="mt-2.5 text-[15px] font-semibold leading-7 text-fog">
                      {review.extraction?.headlineFa ??
                        String(review.article.title ?? 'بدون عنوان')}
                    </h2>
                    <p className="mt-1.5 line-clamp-3 text-[12px] leading-6 text-fog/60">
                      {review.extraction?.summaryFa ?? 'خلاصه استخراج نشده'}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-fog/40">
                      <span>
                        {(review.article.source as { name?: string } | undefined)?.name ??
                          'منبع نامشخص'}
                      </span>
                      {review.article.publishedAt ? (
                        <span>{formatJalali(String(review.article.publishedAt))}</span>
                      ) : null}
                      <span className="text-fog/55">{reasonLabel(log?.reason)}</span>
                    </div>
                    {typeof review.article.canonicalUrl === 'string' ? (
                      <a
                        href={review.article.canonicalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block max-w-full truncate text-[11px] text-accent/90 underline-offset-2 hover:underline"
                      >
                        مشاهدهٔ منبع
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Event comparison */}
              {review.event ? (
                <div className="rounded-2xl border border-fog/10 bg-black/15 px-3.5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[11px] font-semibold text-fog/45">Event انتخاب‌شده</h3>
                    <Link
                      href={`/inbox/${review.event.id}`}
                      className="text-[10px] text-accent underline-offset-2 hover:underline"
                    >
                      باز کردن در صندوق
                    </Link>
                  </div>
                  <p className="mt-1.5 text-sm font-medium leading-6 text-fog">
                    {review.event.title}
                  </p>
                  {review.event.summary ? (
                    <p className="mt-1 line-clamp-2 text-[12px] leading-6 text-fog/55">
                      {review.event.summary}
                    </p>
                  ) : null}
                  {(review.event.articles?.length ?? 0) > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(review.event.articles ?? []).slice(0, 4).map((a, i) => (
                        <span
                          key={i}
                          className="rounded-md border border-fog/10 bg-black/20 px-2 py-0.5 text-[10px] text-fog/50"
                        >
                          {a.article?.source?.name ?? 'منبع'}
                          {a.role ? ` · ${a.role}` : ''}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-fog/15 px-3.5 py-3 text-[12px] text-fog/45">
                  Event متصل نیست — موتور تصمیم به ایجاد Event جدید گرفته.
                </div>
              )}

              {/* Missed merge picker */}
              <div className="rounded-2xl border border-fog/10 bg-black/15 px-3.5 py-3">
                <h3 className="text-[11px] font-semibold text-fog/45">
                  Event صحیح <span className="font-normal text-fog/30">(برای ادغام از‌دست‌رفته)</span>
                </h3>
                <input
                  value={eventQuery}
                  onChange={(e) => setEventQuery(e.target.value)}
                  placeholder="جست‌وجوی عنوان Event…"
                  className="mt-2 w-full rounded-xl border border-fog/12 bg-black/25 px-3 py-2.5 text-sm outline-none focus:border-accent/40"
                />
                {expectedEventId ? (
                  <div className="mt-2 flex items-center justify-between rounded-lg border border-accent/25 bg-accent/10 px-2.5 py-1.5 text-[11px] text-accent">
                    <span className="truncate font-mono">{expectedEventId.slice(0, 13)}…</span>
                    <button type="button" onClick={() => setExpectedEventId(null)}>
                      پاک
                    </button>
                  </div>
                ) : null}
                {eventHits.length > 0 ? (
                  <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto">
                    {eventHits.map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => setExpectedEventId(e.id)}
                          className={`w-full rounded-lg px-2 py-2 text-right text-[11px] leading-5 ${
                            expectedEventId === e.id
                              ? 'bg-accent/20 text-fog'
                              : 'text-fog/70 hover:bg-fog/5'
                          }`}
                        >
                          {e.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="یادداشت کوتاه (اختیاری)…"
                  className="mt-2 w-full rounded-xl border border-fog/12 bg-black/25 px-3 py-2 text-sm outline-none focus:border-accent/40"
                />
              </div>

              {/* Technical collapse */}
              <div className="rounded-2xl border border-fog/10 bg-black/10">
                <button
                  type="button"
                  onClick={() => setTechOpen((v) => !v)}
                  className="flex w-full items-center justify-between px-3.5 py-2.5 text-[11px] text-fog/55"
                >
                  <span>جزئیات فنی شباهت</span>
                  <span>{techOpen ? '▴' : '▾'}</span>
                </button>
                {techOpen && breakdown ? (
                  <div className="fn-fade-in space-y-2 border-t border-fog/10 px-3.5 py-3">
                    {barKeys.map((key) => {
                      const raw = breakdown[key];
                      if (typeof raw !== 'number') return null;
                      return (
                        <div key={key}>
                          <div className="mb-0.5 flex justify-between text-[10px] text-fog/45">
                            <span>{BREAKDOWN_FA[key] ?? key}</span>
                            <span className="tabular-nums">{raw.toFixed(2)}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-black/35">
                            <div
                              className="h-full rounded-full bg-accent/70"
                              style={{ width: `${Math.round(Math.min(1, Math.max(0, raw)) * 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex flex-wrap gap-2 pt-1 text-[10px] text-fog/40">
                      {typeof breakdown.sameMatchId === 'boolean' ? (
                        <span>همان بازی: {breakdown.sameMatchId ? 'بله' : 'خیر'}</span>
                      ) : null}
                      {typeof breakdown.withinCategoryWindow === 'boolean' ? (
                        <span>
                          پنجرهٔ دسته: {breakdown.withinCategoryWindow ? 'بله' : 'خیر'}
                        </span>
                      ) : null}
                    </div>
                    {(log?.candidateSnapshot?.length ?? 0) > 0 ? (
                      <ul className="mt-2 space-y-1 border-t border-fog/10 pt-2">
                        {log!.candidateSnapshot!.slice(0, 5).map((c) => (
                          <li
                            key={c.eventId}
                            className="flex justify-between text-[10px] text-fog/50"
                          >
                            <span className="font-mono">{c.eventId.slice(0, 8)}</span>
                            <span className="tabular-nums">
                              {Math.round(c.score * 100)}٪
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* Relationship secondary */}
              <div className="rounded-2xl border border-fog/10 bg-black/10">
                <button
                  type="button"
                  onClick={() => setRelOpen((v) => !v)}
                  className="flex w-full items-center justify-between px-3.5 py-2.5 text-[11px] text-fog/55"
                >
                  <span>رابطه اشتباه است؟ (Exact / Near / …)</span>
                  <span>{relOpen ? '▴' : '▾'}</span>
                </button>
                {relOpen ? (
                  <div className="fn-fade-in grid grid-cols-3 gap-1.5 border-t border-fog/10 px-3 pb-3 pt-2">
                    {RELATION_VERDICTS.map((v) => (
                      <button
                        key={`${v.verdict}-${v.expected}`}
                        type="button"
                        disabled={busy}
                        onClick={() => void submit(v.verdict, v.expected)}
                        className="rounded-xl border border-fog/12 bg-black/25 py-2.5 text-[11px] text-fog/75 disabled:opacity-40"
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Inline verdicts (always in document flow) */}
              <div className="rounded-2xl border border-accent/25 bg-accent/5 px-3 py-3">
                <p className="mb-2 text-center text-[11px] text-fog/50">
                  تصمیم شما دربارهٔ این clustering چیست؟
                </p>
                <VerdictButtons busy={busy} onSubmit={submit} />
                <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px]">
                  <button
                    type="button"
                    disabled={queueIndex <= 0}
                    onClick={() => goRelative(-1)}
                    className="rounded-lg border border-fog/12 px-3 py-1.5 text-fog/55 disabled:opacity-30"
                  >
                    قبلی
                  </button>
                  <button
                    type="button"
                    disabled={queueIndex < 0 || queueIndex >= queue.length - 1}
                    onClick={() => goRelative(1)}
                    className="rounded-lg border border-fog/12 px-3 py-1.5 text-fog/55 disabled:opacity-30"
                  >
                    بعدی
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </section>
      </div>

      {/* Fixed toolbar above app bottom nav */}
      {review ? (
        <div
          className="fixed inset-x-0 z-[60] border-t border-accent/30 bg-[#071f18] pt-2.5 shadow-[0_-8px_32px_rgba(0,0,0,0.45)]"
          style={{
            bottom: 'calc(3.85rem + env(safe-area-inset-bottom, 0px))',
          }}
          role="toolbar"
          aria-label="تصمیم ارزیابی"
        >
          <div className="mx-auto max-w-3xl px-3 pb-2.5">
            <VerdictButtons busy={busy} onSubmit={submit} />
          </div>
        </div>
      ) : null}
    </main>
  );
}

function VerdictButtons({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (verdict: string, expected: string) => void | Promise<void>;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {PRIMARY_VERDICTS.map((v) => (
        <button
          key={v.verdict}
          type="button"
          disabled={busy}
          title={v.hint}
          onClick={() => void onSubmit(v.verdict, v.expected)}
          className={`rounded-xl py-3 text-[12px] font-semibold leading-tight transition active:scale-[0.98] disabled:opacity-40 ${
            v.tone === 'ok'
              ? 'bg-accent text-ink'
              : v.tone === 'danger'
                ? 'border border-red-400/40 bg-red-400/15 text-red-100'
                : 'border border-amber-400/40 bg-amber-400/15 text-amber-100'
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

function QueueList({
  queue,
  currentId,
  onSelect,
  className = '',
}: {
  queue: QueueItem[];
  currentId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-fog/10 bg-black/20 p-2 ${className}`}>
      <h2 className="px-2 pb-2 text-[11px] font-semibold text-fog/45">
        صف · {queue.length.toLocaleString('fa-IR')}
      </h2>
      <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
        {queue.length === 0 ? (
          <li className="px-2 py-4 text-center text-xs text-fog/35">خالی</li>
        ) : (
          queue.map((item) => {
            const id = item.decisionLog.rawArticleId;
            const active = id === currentId;
            const score = item.decisionLog.finalSimilarity;
            return (
              <li key={item.decisionLog.id}>
                <button
                  type="button"
                  onClick={() => onSelect(id)}
                  className={`w-full rounded-xl px-2.5 py-2 text-right transition ${
                    active
                      ? 'bg-accent/20 ring-1 ring-accent/35'
                      : 'text-fog/70 hover:bg-fog/5'
                  }`}
                >
                  <div className="line-clamp-2 text-[11px] font-medium leading-5 text-fog/90">
                    {item.article?.title ?? id.slice(0, 8)}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-fog/40">
                    <span className="truncate">
                      {item.article?.source?.name ?? '—'} ·{' '}
                      {DECISION_FA[item.decisionLog.decision] ?? item.decisionLog.decision}
                    </span>
                    {score != null ? (
                      <span className={`tabular-nums ${scoreTone(score)}`}>
                        {Math.round(score * 100)}٪
                      </span>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function MetricChip({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-2 py-2 ${
        danger ? 'border-red-400/30 bg-red-400/10' : 'border-fog/10 bg-black/20'
      }`}
    >
      <div className="text-[9px] leading-none text-fog/40">{label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums text-fog">{value}</div>
    </div>
  );
}
