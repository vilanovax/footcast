'use client';

import { useCallback, useEffect, useState } from 'react';
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
  AVAILABLE_NOT_SELECTED: 'واجد شرایط، انتخاب‌نشده',
  UNDER_TARGET: 'کمبود',
  ON_TARGET: 'مناسب',
  OVER_TARGET: 'تراکم بالا',
  NO_TARGET: 'بدون هدف',
};

const TABS = [
  { id: 'trackedEvents', label: 'رویدادها' },
  { id: 'competitions', label: 'لیگ‌ها' },
  { id: 'teams', label: 'تیم‌ها' },
  { id: 'categories', label: 'موضوعات' },
  { id: 'scopes', label: 'Scope' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function CoveragePanel({
  onFilter,
  compact,
  onRundownChanged,
}: {
  onFilter?: (dimension: string, key: string, eventIds: string[]) => void;
  compact?: boolean;
  onRundownChanged?: () => void;
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

  const buckets: CoverageBucket[] = data
    ? (data[tab] as CoverageBucket[]).slice(0, 12)
    : [];

  const mins = Math.floor((data?.summary.estimatedDurationSeconds ?? 0) / 60);
  const secs = (data?.summary.estimatedDurationSeconds ?? 0) % 60;

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

  const recommendations = (data?.recommendations ?? []).filter(
    (r) => !dismissed.has(`${r.type}:${r.dimension}:${r.key}`),
  );

  return (
    <section className="mb-4 rounded-2xl border border-fog/12 bg-black/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-3 text-right"
      >
        <div>
          <p className="text-[11px] font-bold text-fog">وضعیت پوشش امروز</p>
          {data ? (
            <p className="mt-0.5 text-[10px] leading-5 text-fog/50">
              مخزن: {data.summary.selectedEventCount.toLocaleString('fa-IR')} خبر ·{' '}
              {mins.toLocaleString('fa-IR')}:{secs.toString().padStart(2, '0')} · استخراج{' '}
              {data.summary.discoveredEventCount.toLocaleString('fa-IR')} · واجد شرایط{' '}
              {data.summary.eligibleEventCount.toLocaleString('fa-IR')}
            </p>
          ) : (
            <p className="mt-0.5 text-[10px] text-fog/40">
              {loading ? 'در حال محاسبه…' : '—'}
            </p>
          )}
        </div>
        <span className="text-fog/40">{open ? '▴' : '▾'}</span>
      </button>

      {open ? (
        <div className="border-t border-fog/10 px-3 pb-3 pt-2">
          {error ? (
            <p className="mb-2 text-[11px] text-red-200">{error}</p>
          ) : null}
          {flash ? (
            <p className="mb-2 text-[11px] text-accent">{flash}</p>
          ) : null}

          {data ? (
            <>
              <div className="mb-2 flex flex-wrap gap-1.5 text-[10px]">
                {data.summary.underCovered.slice(0, 4).map((x) => (
                  <span
                    key={`u-${x}`}
                    className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-amber-100/90"
                  >
                    کمبود: {x}
                  </span>
                ))}
                {data.summary.overCovered.slice(0, 3).map((x) => (
                  <span
                    key={`o-${x}`}
                    className="rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-red-200"
                  >
                    تراکم: {x}
                  </span>
                ))}
              </div>

              <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] ${
                      tab === t.id
                        ? 'bg-accent/20 text-accent ring-1 ring-accent/35'
                        : 'bg-black/20 text-fog/55'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {buckets.map((b) => (
                  <li key={`${b.dimension}-${b.key}`}>
                    <button
                      type="button"
                      onClick={() =>
                        onFilter?.(
                          b.dimension,
                          b.key,
                          b.eventIds?.discovered ?? [],
                        )
                      }
                      className="w-full rounded-xl border border-fog/10 bg-black/15 px-2.5 py-2 text-right transition hover:border-accent/35"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-fog">
                          {b.label}
                        </span>
                        <span className="text-[9px] text-fog/45">
                          {STATUS_FA[b.status] ?? b.status}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] leading-5 text-fog/55">
                        استخراج {b.discoveredEventCount.toLocaleString('fa-IR')} · واجد شرایط{' '}
                        {b.eligibleEventCount.toLocaleString('fa-IR')} · مخزن{' '}
                        {b.selectedEventCount.toLocaleString('fa-IR')}
                        {b.averageScore != null
                          ? ` · میانگین ${b.averageScore.toLocaleString('fa-IR')}`
                          : ''}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>

              {recommendations.length > 0 ? (
                <div className="mt-3">
                  <p className="mb-1.5 text-[11px] font-bold text-fog">
                    پیشنهاد سردبیر ({recommendations.length.toLocaleString('fa-IR')})
                  </p>
                  <ul className="space-y-1.5">
                    {recommendations.slice(0, 5).map((r) => {
                      const recKey = `${r.type}:${r.dimension}:${r.key}`;
                      const suggested = r.suggestedEventIds[0];
                      return (
                        <li
                          key={recKey}
                          className="rounded-lg border border-fog/10 bg-black/10 px-2.5 py-2 text-[10px] leading-5 text-fog/70"
                        >
                          <span className="font-semibold text-fog/85">{r.type}</span>
                          <br />
                          {r.message}
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {suggested && onFilter ? (
                              <button
                                type="button"
                                className="rounded border border-fog/20 px-2 py-1 text-[10px]"
                                onClick={() =>
                                  onFilter(r.dimension, r.key, r.suggestedEventIds)
                                }
                              >
                                نمایش
                              </button>
                            ) : null}
                            {suggested &&
                            (r.type === 'COVERAGE_GAP' ||
                              r.type === 'AVAILABLE_NOT_SELECTED') ? (
                              <button
                                type="button"
                                disabled={busyKey === recKey}
                                className="rounded bg-accent px-2 py-1 text-[10px] font-semibold text-ink disabled:opacity-50"
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
                                className="rounded border border-accent/40 px-2 py-1 text-[10px] text-accent disabled:opacity-50"
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
                            <button
                              type="button"
                              className="rounded border border-fog/15 px-2 py-1 text-[10px] text-fog/50"
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

              <p className="mt-3 text-[9px] leading-4 text-fog/35">{data.note}</p>
              {(data.untaggedEventCount ?? 0) > 0 ? (
                <p className="mt-1 text-[9px] text-fog/40">
                  {data.untaggedEventCount!.toLocaleString('fa-IR')} خبر هنوز Team/Competition
                  ندارند (برچسب از card/signature).
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => void load()}
                className="mt-2 text-[10px] text-fog/45 underline"
              >
                بروزرسانی پوشش
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
