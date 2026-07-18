'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, clearTokens, getToken } from '../../lib/api';
import { CoveragePanel } from '../../components/CoveragePanel';
import { WorkflowGuide } from '../../components/WorkflowGuide';
import { EmptyState, PageHeader, SkeletonList } from '../../components/ui';
import { StatusBadge } from '../../components/StatusBadge';
import { labelAddedMode, labelReviewStatus } from '../../lib/automation-ui';

type CoverageBucket = {
  key: string;
  label: string;
  count: number;
  durationSeconds: number;
  percentDuration: number;
};

type Coverage = {
  byScope: CoverageBucket[];
  byCategory: CoverageBucket[];
  totalDurationSeconds: number;
  totalCount: number;
  softViolations: string[];
};

type RundownItem = {
  id: string;
  newsEventId: string;
  status: string;
  section: string;
  estimatedDurationSeconds: number;
  position: number;
  isLeadStory: boolean;
  isPinned: boolean;
  effectiveScore?: number | null;
  addedMode?: string | null;
  reviewStatus?: string | null;
  automationReason?: string | null;
  event?: {
    id: string;
    title: string;
    scope?: string | null;
    category?: string | null;
    officialStatus?: string | null;
  } | null;
};

type Rundown = {
  id: string;
  editorialDate: string;
  status: string;
  deadlineAt: string;
  targetDurationSeconds: number;
  items?: RundownItem[];
  coverage?: Coverage;
  activeItemCount?: number;
};

const STATUS_FA: Record<string, string> = {
  COLLECTING: 'در حال جمع‌آوری',
  EDITOR_REVIEW: 'بازبینی سردبیر',
  PRE_FINAL: 'پیش‌نهایی',
  LOCKED: 'قفل‌شده',
  REOPENED: 'بازگشایی‌شده',
  SCRIPT_GENERATING: 'تولید متن',
  SCRIPT_READY: 'متن آماده',
  FINALIZED: 'نهایی',
};

export default function RundownPage() {
  const router = useRouter();
  const [rundown, setRundown] = useState<Rundown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  const load = useCallback(async () => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<Rundown>('/rundown/today');
      setRundown(res.data);
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

  const activeItems = (rundown?.items ?? []).filter(
    (i) => i.status !== 'REMOVED' && i.status !== 'RECOMMENDED_FOR_REMOVAL',
  );
  const autoPending = activeItems.filter(
    (i) => i.addedMode === 'AUTO' && i.reviewStatus === 'PENDING_REVIEW',
  );
  const locked =
    rundown?.status === 'LOCKED' ||
    rundown?.status === 'SCRIPT_GENERATING' ||
    rundown?.status === 'SCRIPT_READY' ||
    rundown?.status === 'FINALIZED';

  async function reviewItem(
    id: string,
    reviewStatus: 'ACCEPTED' | 'DISMISSED',
  ) {
    setBusy(true);
    try {
      const res = await apiFetch<Rundown>(`/rundown/items/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ reviewStatus }),
      });
      setRundown(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بازبینی ناموفق');
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(id: string) {
    setBusy(true);
    try {
      const res = await apiFetch<Rundown>(`/rundown/items/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason: 'editor_removed' }),
      });
      setRundown(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حذف ناموفق');
    } finally {
      setBusy(false);
    }
  }

  async function undoAutoAdd(id: string) {
    setBusy(true);
    try {
      const res = await apiFetch<Rundown>(`/rundown/items/${id}/undo-auto`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'editor_undo_auto_add' }),
      });
      setRundown(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بازگردانی ناموفق');
    } finally {
      setBusy(false);
    }
  }

  async function setLead(id: string) {
    setBusy(true);
    try {
      const res = await apiFetch<Rundown>(`/rundown/items/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isLeadStory: true, section: 'LEAD' }),
      });
      setRundown(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  }

  async function togglePin(id: string, pinned: boolean) {
    setBusy(true);
    try {
      const res = await apiFetch<Rundown>(`/rundown/items/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPinned: !pinned }),
      });
      setRundown(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  }

  async function lock() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<Rundown>('/rundown/today/lock', {
        method: 'POST',
        body: '{}',
      });
      setRundown(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'قفل ناموفق');
    } finally {
      setBusy(false);
    }
  }

  async function reopen() {
    if (reopenReason.trim().length < 3) {
      setError('دلیل بازگشایی لازم است');
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch<Rundown>('/rundown/today/reopen', {
        method: 'POST',
        body: JSON.stringify({ reason: reopenReason.trim() }),
      });
      setRundown(res.data);
      setReopenReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بازگشایی ناموفق');
    } finally {
      setBusy(false);
    }
  }

  const coverage = rundown?.coverage;
  const target = rundown?.targetDurationSeconds ?? 600;

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 pb-28 pt-6" dir="rtl">
      <PageHeader
        title="Today"
        subtitle="تا ۱۶:۰۰ جمع کن · بالانس کن · قفل"
        action={
          <Link
            href="/inbox"
            className="rounded-lg border border-fog/15 px-3 py-2 text-xs text-fog/80"
          >
            inbox
          </Link>
        }
      />

      <WorkflowGuide
        activeOverride="podcast"
        counts={{ ready: activeItems.length }}
      />

      <CoveragePanel />

      {loading ? <SkeletonList rows={5} /> : null}

      {error ? (
        <p className="mb-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {!loading && rundown ? (
        <>
          <div className="mb-4 rounded-2xl border border-fog/12 bg-black/20 px-3 py-3 text-[12px] leading-6 text-fog/75">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {rundown.editorialDate} ·{' '}
                {STATUS_FA[rundown.status] ?? rundown.status}
              </span>
              <span className="text-fog/45">
                دeadline{' '}
                {new Date(rundown.deadlineAt).toLocaleTimeString('fa-IR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Asia/Tehran',
                })}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-fog/50">
              زمان تخمینی{' '}
              {(coverage?.totalDurationSeconds ?? 0).toLocaleString('fa-IR')} از{' '}
              {target.toLocaleString('fa-IR')} ثانیه ·{' '}
              {activeItems.length.toLocaleString('fa-IR')} خبر فعال
            </p>
          </div>

          {coverage ? (
            <section className="mb-4 rounded-2xl border border-fog/12 bg-black/15 p-3">
              <h2 className="mb-2 text-xs font-bold text-fog">توازن پوشش (بر اساس زمان)</h2>
              <ul className="space-y-1.5">
                {coverage.byScope.map((b) => (
                  <li key={b.key} className="text-[11px] text-fog/70">
                    <div className="mb-0.5 flex justify-between">
                      <span>
                        {b.label} · {b.count.toLocaleString('fa-IR')} خبر
                      </span>
                      <span>
                        {b.durationSeconds.toLocaleString('fa-IR')}ث ·{' '}
                        {b.percentDuration.toLocaleString('fa-IR')}٪
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-fog/10">
                      <div
                        className="h-full rounded-full bg-accent/70"
                        style={{ width: `${Math.min(100, b.percentDuration)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              {coverage.byCategory.length > 0 ? (
                <p className="mt-2 text-[10px] leading-5 text-fog/45">
                  موضوع:{' '}
                  {coverage.byCategory
                    .slice(0, 4)
                    .map(
                      (c) =>
                        `${c.key} ${c.count.toLocaleString('fa-IR')}`,
                    )
                    .join(' · ')}
                </p>
              ) : null}
              {coverage.softViolations.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {coverage.softViolations.map((v) => (
                    <li
                      key={v}
                      className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-[10px] text-amber-100/90"
                    >
                      {v}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          <section className="mb-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-fog">خبرهای Today</h2>
              {autoPending.length > 0 ? (
                <span className="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[10px] text-amber-100">
                  {autoPending.length.toLocaleString('fa-IR')} ورود خودکار در انتظار تأیید
                </span>
              ) : null}
            </div>
            {activeItems.length === 0 ? (
              <EmptyState
                title="Today خالی است"
                description="از inbox خبرها را اضافه کن. تأیید خبر ≠ ورود خودکار به Today."
                action={
                  <Link
                    href="/inbox"
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-ink"
                  >
                    برو به inbox
                  </Link>
                }
              />
            ) : (
              <ul className="space-y-2">
                {activeItems.map((item) => {
                  const isAuto = item.addedMode === 'AUTO';
                  const needsAck =
                    isAuto && item.reviewStatus === 'PENDING_REVIEW';
                  return (
                    <li
                      key={item.id}
                      className={`rounded-xl border px-3 py-2.5 ${
                        needsAck
                          ? 'border-amber-400/35 bg-amber-400/[0.07]'
                          : isAuto
                            ? 'border-accent/25 bg-accent/[0.05]'
                            : 'border-fog/10 bg-black/15'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                            {item.isLeadStory ? (
                              <StatusBadge label="Lead" tone="accent" />
                            ) : null}
                            {item.isPinned ? (
                              <StatusBadge label="سنجاق" tone="neutral" />
                            ) : null}
                            {isAuto ? (
                              <StatusBadge
                                label={labelAddedMode(item.addedMode)}
                                tone="accent"
                              />
                            ) : (
                              <StatusBadge label="دستی" tone="neutral" />
                            )}
                            {item.reviewStatus ? (
                              <StatusBadge
                                label={labelReviewStatus(item.reviewStatus)}
                                tone={
                                  item.reviewStatus === 'PENDING_REVIEW'
                                    ? 'warn'
                                    : item.reviewStatus === 'ACCEPTED'
                                      ? 'ok'
                                      : 'neutral'
                                }
                              />
                            ) : null}
                            <span className="text-[10px] text-fog/45">
                              {item.section}
                            </span>
                            <span className="text-[10px] text-fog/45">
                              {item.estimatedDurationSeconds.toLocaleString('fa-IR')}ث
                            </span>
                          </div>
                          <Link
                            href={`/inbox/${item.newsEventId}`}
                            className="text-sm font-semibold leading-6 text-fog hover:text-accent"
                          >
                            {item.event?.title ?? 'بدون عنوان'}
                          </Link>
                          {isAuto ? (
                            <p className="mt-1 text-[10px] leading-5 text-fog/50">
                              این خبر به‌صورت خودکار وارد مخزن امروز شده است.
                              {item.automationReason
                                ? ` · ${item.automationReason}`
                                : ''}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {!locked ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {needsAck ? (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void reviewItem(item.id, 'ACCEPTED')}
                                className="rounded border border-emerald-400/35 bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-100"
                              >
                                تأیید ورود خودکار
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void reviewItem(item.id, 'DISMISSED')}
                                className="rounded border border-red-400/30 px-2 py-1 text-[10px] text-red-200"
                              >
                                رد / حذف
                              </button>
                            </>
                          ) : null}
                          {isAuto && !needsAck ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void undoAutoAdd(item.id)}
                              className="rounded border border-amber-400/35 bg-amber-400/10 px-2 py-1 text-[10px] text-amber-100"
                            >
                              Undo ورود خودکار
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void setLead(item.id)}
                            className="rounded border border-fog/15 px-2 py-1 text-[10px]"
                          >
                            Lead
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void togglePin(item.id, item.isPinned)}
                            className="rounded border border-fog/15 px-2 py-1 text-[10px]"
                          >
                            {item.isPinned ? 'برداشتن سنجاق' : 'سنجاق'}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void removeItem(item.id)}
                            className="rounded border border-red-400/30 px-2 py-1 text-[10px] text-red-200"
                          >
                            حذف از امروز
                          </button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-fog/12 bg-black/20 p-3">
            {!locked ? (
              <>
                <p className="mb-2 text-[11px] leading-5 text-fog/55">
                  با قفل، آیتم‌های فعال نهایی می‌شوند و آمادهٔ ساخت متن پادکست می‌گردند.
                  خبر فوری بعداً با بازگشایی + دلیل ممکن است.
                </p>
                <button
                  type="button"
                  disabled={busy || activeItems.length === 0}
                  onClick={() => void lock()}
                  className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-ink disabled:opacity-50"
                >
                  قفل سردبیری (۱۶:۰۰)
                </button>
                <Link
                  href="/podcasts"
                  className="mt-2 flex w-full items-center justify-center rounded-xl border border-fog/15 py-2.5 text-xs text-fog/70"
                >
                  ساخت اپیزود از Today (بعد از قفل)
                </Link>
              </>
            ) : (
              <>
                <p className="mb-2 text-[11px] text-fog/55">
                  Today قفل است. برای خبر فوری بازگشایی کن.
                </p>
                <input
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="دلیل بازگشایی…"
                  className="mb-2 w-full rounded-lg border border-fog/15 bg-black/20 px-3 py-2 text-xs outline-none"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void reopen()}
                  className="w-full rounded-xl border border-amber-400/40 py-2.5 text-sm text-amber-100"
                >
                  بازگشایی با Audit
                </button>
                <Link
                  href="/podcasts"
                  className="mt-2 flex w-full items-center justify-center rounded-xl bg-accent py-3 text-sm font-bold text-ink"
                >
                  ادامه ساخت پادکست
                </Link>
              </>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
