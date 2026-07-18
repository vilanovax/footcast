'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';

export type CoverageBucket = {
  dimension: string;
  key: string;
  label: string;
  discoveredEventCount: number;
  eligibleEventCount: number;
  selectedEventCount: number;
  estimatedDurationSeconds: number;
  averageScore: number | null;
  status: string;
  eventIds?: { discovered: string[]; eligible: string[]; selected: string[] };
};

export type CoverageRecommendation = {
  type: string;
  dimension: string;
  key: string;
  message: string;
  eligibleCount: number;
  selectedCount: number;
  suggestedEventIds: string[];
  replaceEventId?: string | null;
  reasons: string[];
};

export type CoverageReport = {
  editorialDate: string;
  summary: {
    discoveredEventCount: number;
    eligibleEventCount: number;
    selectedEventCount: number;
    estimatedDurationSeconds: number;
    targetDurationSeconds: number;
    underCovered: string[];
    overCovered: string[];
  };
  scopes: CoverageBucket[];
  teams: CoverageBucket[];
  competitions: CoverageBucket[];
  categories: CoverageBucket[];
  trackedEvents: CoverageBucket[];
  recommendations: CoverageRecommendation[];
  note: string;
  untaggedEventCount?: number;
};

const STATUS_FA: Record<string, string> = {
  NO_AVAILABLE_NEWS: 'بدون خبر',
  AVAILABLE_NOT_SELECTED: 'آماده انتخاب',
  UNDER_TARGET: 'کمبود',
  ON_TARGET: 'مناسب',
  OVER_TARGET: 'تراکم',
  NO_TARGET: 'بدون هدف',
};

const STATUS_TONE: Record<string, string> = {
  NO_AVAILABLE_NEWS: 'bg-fog/10 text-fog/55 ring-fog/15',
  AVAILABLE_NOT_SELECTED: 'bg-accent/15 text-accent ring-accent/30',
  UNDER_TARGET: 'bg-amber-400/15 text-amber-100 ring-amber-400/30',
  ON_TARGET: 'bg-emerald-400/15 text-emerald-100 ring-emerald-400/25',
  OVER_TARGET: 'bg-red-400/15 text-red-200 ring-red-400/30',
  NO_TARGET: 'bg-fog/10 text-fog/50 ring-fog/15',
};

const REC_TYPE_FA: Record<string, string> = {
  NO_AVAILABLE_NEWS: 'خبری نیست',
  COVERAGE_GAP: 'شکاف پوشش',
  AVAILABLE_NOT_SELECTED: 'آمادهٔ Today',
  OVER_COVERED: 'تراکم پوشش',
  TEAM_REDUNDANCY: 'تکرار تیم',
  CATEGORY_REDUNDANCY: 'تکرار موضوع',
  REPLACEMENT_SUGGESTION: 'پیشنهاد جایگزینی',
};

const STATUS_RANK: Record<string, number> = {
  AVAILABLE_NOT_SELECTED: 0,
  UNDER_TARGET: 1,
  OVER_TARGET: 2,
  ON_TARGET: 3,
  NO_TARGET: 4,
  NO_AVAILABLE_NEWS: 5,
};

const TABS = [
  { id: 'trackedEvents', label: 'رویدادها' },
  { id: 'competitions', label: 'لیگ‌ها' },
  { id: 'teams', label: 'تیم‌ها' },
  { id: 'categories', label: 'موضوعات' },
  { id: 'scopes', label: 'پوشش' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toLocaleString('fa-IR')}:${s.toString().padStart(2, '0')}`;
}

function MetricCell({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-black/25 px-2 py-1.5 text-center">
      <p
        className={`font-display text-sm tabular-nums leading-none ${
          emphasize ? 'text-accent' : 'text-fog/90'
        }`}
      >
        {value.toLocaleString('fa-IR')}
      </p>
      <p className="mt-1 text-[9px] leading-none text-fog/50">{label}</p>
    </div>
  );
}

export function CoveragePanel({
  onFilter,
  compact,
  onRundownChanged,
  onCrawlHint,
}: {
  onFilter?: (dimension: string, key: string, eventIds: string[]) => void;
  compact?: boolean;
  onRundownChanged?: () => void;
  /** Optional: parent can scroll/focus crawl CTA when no news */
  onCrawlHint?: () => void;
}) {
  const [open, setOpen] = useState(!compact);
  const [tab, setTab] = useState<TabId>('teams');
  const [data, setData] = useState<CoverageReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<CoverageReport>('/editorial/coverage/today');
      setData(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در پوشش');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const buckets = useMemo(() => {
    if (!data) return [];
    const list = [...(data[tab] as CoverageBucket[])];
    list.sort(
      (a, b) =>
        (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) ||
        b.eligibleEventCount - a.eligibleEventCount ||
        b.discoveredEventCount - a.discoveredEventCount,
    );
    return list.slice(0, 12);
  }, [data, tab]);

  const targetSec = data?.summary.targetDurationSeconds ?? 10 * 60;
  const estSec = data?.summary.estimatedDurationSeconds ?? 0;
  const durationPct = Math.round((estSec / Math.max(targetSec, 1)) * 100);

  const gapCount = data?.summary.underCovered.length ?? 0;
  const readyCount =
    data?.recommendations.filter((r) => r.suggestedEventIds.length > 0).length ?? 0;

  const recommendations = (data?.recommendations ?? []).filter(
    (r) => !dismissed.has(`${r.type}:${r.dimension}:${r.key}`),
  );

  async function addSuggested(eventId: string, recKey: string) {
    setBusyKey(recKey);
    setFlash(null);
    setError(null);
    try {
      await apiFetch('/rundown/today/items', {
        method: 'POST',
        body: JSON.stringify({ eventId }),
      });
      setFlash('به Today اضافه شد');
      await load();
      onRundownChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'افزودن ناموفق');
    } finally {
      setBusyKey(null);
    }
  }

  async function replaceSuggested(
    newEventId: string,
    replaceEventId: string,
    recKey: string,
  ) {
    setBusyKey(recKey);
    setFlash(null);
    setError(null);
    try {
      await apiFetch('/rundown/today/replace', {
        method: 'POST',
        body: JSON.stringify({ newEventId, replaceEventId }),
      });
      setFlash('جایگزینی با تأیید شما اعمال شد');
      await load();
      onRundownChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'جایگزینی ناموفق');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className="mb-4 overflow-hidden rounded-2xl border border-fog/12 bg-gradient-to-b from-black/30 to-black/15">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-3 text-right transition hover:bg-white/[0.02]"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[12px] font-bold text-fog">پوشش امروز</p>
            {gapCount > 0 ? (
              <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[9px] font-medium text-amber-100 ring-1 ring-amber-400/25">
                {gapCount.toLocaleString('fa-IR')} کمبود
              </span>
            ) : null}
            {readyCount > 0 ? (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-medium text-accent ring-1 ring-accent/30">
                {readyCount.toLocaleString('fa-IR')} پیشنهاد فعال
              </span>
            ) : null}
          </div>
          {data ? (
            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-fog/55">
                <span>
                  Today {data.summary.selectedEventCount.toLocaleString('fa-IR')} خبر ·{' '}
                  {formatDuration(estSec)}
                </span>
                <span className="tabular-nums">هدف {formatDuration(targetSec)}</span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-black/40"
                role="progressbar"
                aria-valuenow={durationPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="پیشرفت زمان پادکست"
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    durationPct < 40
                      ? 'bg-amber-400/80'
                      : durationPct > 110
                        ? 'bg-red-400/80'
                        : 'bg-accent'
                  }`}
                  style={{ width: `${Math.min(durationPct, 100)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10px] leading-4 text-fog/45">
                استخراج {data.summary.discoveredEventCount.toLocaleString('fa-IR')} · واجد شرایط{' '}
                {data.summary.eligibleEventCount.toLocaleString('fa-IR')}
              </p>
            </div>
          ) : (
            <p className="mt-1 text-[10px] text-fog/40">
              {loading ? 'در حال محاسبه…' : '—'}
            </p>
          )}
        </div>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-fog/15 text-fog/50 transition ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open ? (
        <div className="fn-fade-in border-t border-fog/10 px-3 pb-3 pt-2.5">
          {error ? (
            <p className="mb-2 rounded-lg border border-red-400/25 bg-red-400/10 px-2.5 py-2 text-[11px] text-red-100">
              {error}
            </p>
          ) : null}
          {flash ? (
            <p className="mb-2 rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-2 text-[11px] text-accent">
              {flash}
            </p>
          ) : null}

          {data ? (
            <>
              {(data.summary.underCovered.length > 0 ||
                data.summary.overCovered.length > 0) && (
                <div className="mb-2.5 flex flex-wrap gap-1.5">
                  {data.summary.underCovered.slice(0, 4).map((x) => (
                    <span
                      key={`u-${x}`}
                      className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-100/90 ring-1 ring-amber-400/25"
                    >
                      کمبود · {x}
                    </span>
                  ))}
                  {data.summary.overCovered.slice(0, 3).map((x) => (
                    <span
                      key={`o-${x}`}
                      className="rounded-full bg-red-400/10 px-2 py-0.5 text-[10px] text-red-200 ring-1 ring-red-400/25"
                    >
                      تراکم · {x}
                    </span>
                  ))}
                </div>
              )}

              <div
                className="mb-2.5 flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="tablist"
                aria-label="ابعاد پوشش"
              >
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] transition ${
                      tab === t.id
                        ? 'bg-accent text-ink font-semibold shadow-sm shadow-accent/20'
                        : 'bg-black/25 text-fog/60 ring-1 ring-fog/10 hover:text-fog/85'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {buckets.map((b) => {
                  const empty = b.status === 'NO_AVAILABLE_NEWS';
                  const filterIds =
                    (b.eligibleEventCount > 0
                      ? b.eventIds?.eligible
                      : b.eventIds?.discovered) ?? [];
                  return (
                    <li key={`${b.dimension}-${b.key}`}>
                      <button
                        type="button"
                        disabled={empty || filterIds.length === 0}
                        onClick={() =>
                          onFilter?.(b.dimension, b.key, filterIds)
                        }
                        className={`w-full rounded-xl border px-2.5 py-2.5 text-right transition ${
                          empty
                            ? 'cursor-default border-fog/8 bg-black/10 opacity-70'
                            : 'border-fog/12 bg-black/20 hover:border-accent/40 hover:bg-black/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[12px] font-semibold leading-5 text-fog">
                            {b.label}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ring-1 ${
                              STATUS_TONE[b.status] ?? STATUS_TONE.NO_TARGET
                            }`}
                          >
                            {STATUS_FA[b.status] ?? b.status}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-1.5">
                          <MetricCell label="استخراج" value={b.discoveredEventCount} />
                          <MetricCell
                            label="واجد شرایط"
                            value={b.eligibleEventCount}
                            emphasize={b.eligibleEventCount > 0 && b.selectedEventCount === 0}
                          />
                          <MetricCell
                            label="Today"
                            value={b.selectedEventCount}
                            emphasize={b.selectedEventCount > 0}
                          />
                        </div>
                        {b.averageScore != null ? (
                          <p className="mt-1.5 text-[10px] text-fog/45">
                            میانگین امتیاز {b.averageScore.toLocaleString('fa-IR')}
                            {!empty && filterIds.length > 0 ? ' · ضربه برای فیلتر inbox' : ''}
                          </p>
                        ) : !empty && filterIds.length > 0 ? (
                          <p className="mt-1.5 text-[10px] text-fog/40">ضربه برای فیلتر inbox</p>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>

              {recommendations.length > 0 ? (
                <div className="mt-3.5">
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <p className="text-[12px] font-bold text-fog">پیشنهاد سردبیر</p>
                    <span className="text-[10px] text-fog/40">
                      {recommendations.length.toLocaleString('fa-IR')} مورد
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {recommendations.slice(0, 5).map((r) => {
                      const recKey = `${r.type}:${r.dimension}:${r.key}`;
                      const suggested = r.suggestedEventIds[0];
                      const typeFa = REC_TYPE_FA[r.type] ?? 'پیشنهاد';
                      const isEmptyNews = r.type === 'NO_AVAILABLE_NEWS';
                      return (
                        <li
                          key={recKey}
                          className="rounded-xl border border-fog/10 bg-black/20 px-3 py-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ring-1 ${
                                isEmptyNews
                                  ? 'bg-fog/10 text-fog/55 ring-fog/15'
                                  : suggested
                                    ? 'bg-accent/15 text-accent ring-accent/30'
                                    : 'bg-amber-400/10 text-amber-100 ring-amber-400/25'
                              }`}
                            >
                              {typeFa}
                            </span>
                          </div>
                          <p className="mt-1.5 text-[11px] leading-5 text-fog/75">{r.message}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {suggested && onFilter ? (
                              <button
                                type="button"
                                className="rounded-lg border border-fog/20 bg-black/20 px-2.5 py-1.5 text-[11px] text-fog/80 transition hover:border-fog/35"
                                onClick={() =>
                                  onFilter(r.dimension, r.key, r.suggestedEventIds)
                                }
                              >
                                نمایش در inbox
                              </button>
                            ) : null}
                            {suggested &&
                            (r.type === 'COVERAGE_GAP' ||
                              r.type === 'AVAILABLE_NOT_SELECTED') ? (
                              <button
                                type="button"
                                disabled={busyKey === recKey}
                                className="rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-ink disabled:opacity-50"
                                onClick={() => void addSuggested(suggested, recKey)}
                              >
                                + Today
                              </button>
                            ) : null}
                            {suggested &&
                            r.type === 'REPLACEMENT_SUGGESTION' &&
                            r.replaceEventId ? (
                              <button
                                type="button"
                                disabled={busyKey === recKey}
                                className="rounded-lg border border-accent/40 px-2.5 py-1.5 text-[11px] text-accent disabled:opacity-50"
                                onClick={() =>
                                  void replaceSuggested(
                                    suggested,
                                    r.replaceEventId!,
                                    recKey,
                                  )
                                }
                              >
                                جایگزینی
                              </button>
                            ) : null}
                            {isEmptyNews && onCrawlHint ? (
                              <button
                                type="button"
                                className="rounded-lg border border-accent/35 bg-accent/10 px-2.5 py-1.5 text-[11px] text-accent"
                                onClick={onCrawlHint}
                              >
                                خزش خبر
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="rounded-lg px-2.5 py-1.5 text-[11px] text-fog/45 transition hover:text-fog/70"
                              onClick={() =>
                                setDismissed((prev) => new Set(prev).add(recKey))
                              }
                            >
                              نادیده
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {(data.untaggedEventCount ?? 0) > 0 ? (
                <p className="mt-3 text-[10px] leading-4 text-fog/40">
                  {data.untaggedEventCount!.toLocaleString('fa-IR')} خبر هنوز برچسب تیم/لیگ
                  ندارند — بعد از استخراج کارت AI برچسب می‌خورند.
                </p>
              ) : null}

              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-[9px] leading-4 text-fog/30 line-clamp-2">{data.note}</p>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="shrink-0 rounded-lg border border-fog/15 px-2.5 py-1 text-[10px] text-fog/55 transition hover:border-fog/30 hover:text-fog/80"
                >
                  بروزرسانی
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
