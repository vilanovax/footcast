'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch, clearTokens, getToken } from '../../../lib/api';
import { formatJalali } from '../../../lib/dates';
import {
  eventStatusTone,
  labelCategory,
  labelEventStatus,
  labelArticleRole,
  labelOfficial,
  labelRecommendation,
  labelScope,
} from '../../../lib/labels';
import { StatusBadge } from '../../../components/StatusBadge';

type EventDetail = {
  id: string;
  title: string;
  summary?: string | null;
  status: string;
  scope?: string | null;
  category?: string | null;
  officialStatus?: string | null;
  importanceScore?: number | null;
  credibilityScore?: number | null;
  effectiveFinalScore?: number | null;
  podcastValueScore?: number | null;
  recommendation?: string | null;
  articleCount?: number;
  independentSourceCount?: number;
  latestDevelopmentSummary?: string | null;
  eventAction?: string | null;
  latestDevelopment?: {
    summary?: string;
    action?: string | null;
    developmentType?: string;
    occurredAt?: string | null;
  } | null;
  timelineItems?: Array<{
    id: string;
    summary: string;
    action?: string | null;
    developmentType: string;
    isMajorDevelopment?: boolean;
    occurredAt?: string | null;
    createdAt?: string;
  }>;
  scores?: Array<{
    finalScore: number;
    credibilityScore?: number;
    importanceScore?: number;
    podcastValueScore?: number;
    recommendation?: string;
    reasons?: string[];
    ruleHits?: string[];
    breakdown?: Record<string, number | string | boolean>;
    factors?: Record<string, number>;
    penalties?: Record<string, number>;
    bonuses?: Array<{ code: string; value: number; reason: string }>;
    penaltyItems?: Array<{ code: string; value: number; reason: string }>;
  }>;
  activeOverride?: {
    id: string;
    overriddenFinalScore: number;
    automaticFinalScore: number;
    reason: string;
  } | null;
  notes?: Array<{ id: string; body: string; createdAt?: string }>;
  articles?: Array<{
    role?: string;
    articleId?: string;
    similarityScore?: number | null;
    relationshipDecision?: string | null;
    article?: {
      id?: string;
      title?: string;
      canonicalUrl?: string;
      status?: string;
      source?: { name?: string; credibilitySeed?: number };
    };
  }>;
  conflicts?: Array<{ id: string; status: string; conflictType: string }>;
};

type EventSearchHit = { id: string; title: string; category?: string | null };

export default function InboxDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [overrideScore, setOverrideScore] = useState('70');
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverride, setShowOverride] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [mergeQuery, setMergeQuery] = useState('');
  const [mergeHits, setMergeHits] = useState<EventSearchHit[]>([]);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [mergeReason, setMergeReason] = useState('');
  const [splitIds, setSplitIds] = useState<string[]>([]);
  const [splitReason, setSplitReason] = useState('');
  const [splitHeadline, setSplitHeadline] = useState('');

  const load = useCallback(async () => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    try {
      const res = await apiFetch<EventDetail>(`/editorial/events/${id}`);
      setEvent(res.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'خطا';
      setError(message);
      if (/unauthorized|jwt|token/i.test(message)) {
        clearTokens();
        router.replace('/login');
      }
    }
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(decision: 'approve' | 'reject') {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/editorial/events/${id}/${decision}`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setFlash(
        decision === 'approve'
          ? 'تأیید شد — در حال افزودن به Today…'
          : 'رد شد',
      );
      if (decision === 'approve') {
        try {
          await apiFetch('/rundown/today/items', {
            method: 'POST',
            body: JSON.stringify({ eventId: id }),
          });
          setFlash('تأیید شد و به Today اضافه شد');
        } catch {
          setFlash('تأیید شد — افزودن دستی از صفحهٔ Today');
        }
      }
      await load();
      if (decision === 'approve') {
        window.setTimeout(() => router.push('/rundown'), 900);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در تصمیم');
    } finally {
      setBusy(false);
    }
  }

  async function score() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/editorial/events/${id}/score?sync=1`, { method: 'POST', body: '{}' });
      setFlash('امتیاز به‌روز شد');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در امتیاز');
    } finally {
      setBusy(false);
    }
  }

  async function reextract() {
    if (
      !window.confirm(
        'استخراج AI برای مقالات این خبر دوباره صف شود؟ بعد از extract، clustering خودکار اجرا می‌شود.',
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ succeeded?: number; failed?: number; note?: string }>(
        `/editorial/events/${id}/reextract`,
        { method: 'POST', body: '{}' },
      );
      setFlash(
        `استخراج مجدد: ${res.data?.succeeded ?? 0} مقاله در صف` +
          (res.data?.failed ? ` (${res.data.failed} ناموفق)` : ''),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در استخراج مجدد');
    } finally {
      setBusy(false);
    }
  }

  async function saveNote() {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/editorial/events/${id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body: note }),
      });
      setNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در یادداشت');
    } finally {
      setBusy(false);
    }
  }

  async function applyOverride() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/editorial/events/${id}/score-override`, {
        method: 'POST',
        body: JSON.stringify({
          overriddenFinalScore: Number(overrideScore),
          reason: overrideReason.trim(),
        }),
      });
      setFlash('امتیاز دستی اعمال شد');
      setShowOverride(false);
      setOverrideReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در override');
    } finally {
      setBusy(false);
    }
  }

  async function revokeOverride() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/editorial/events/${id}/score-override`, { method: 'DELETE' });
      setFlash('override لغو شد — امتیاز خودکار برگشت');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در لغو override');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!showMerge || !mergeQuery.trim()) {
      setMergeHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      void apiFetch<EventSearchHit[]>(
        `/clustering/events/search?q=${encodeURIComponent(mergeQuery)}&limit=10`,
      ).then((res) =>
        setMergeHits(
          (Array.isArray(res.data) ? res.data : []).filter((e) => e.id !== id),
        ),
      );
    }, 250);
    return () => window.clearTimeout(t);
  }, [showMerge, mergeQuery, id]);

  async function confirmMerge() {
    if (!mergeTargetId || mergeReason.trim().length < 3) return;
    if (
      !window.confirm(
        'ادغام Event فعلی در Event مقصد انجام شود؟ مقالات و timeline منتقل می‌شوند؛ Event فعلی وضعیت MERGED می‌گیرد.',
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/events/merge', {
        method: 'POST',
        body: JSON.stringify({
          primaryEventId: mergeTargetId,
          secondaryEventIds: [id],
          reason: mergeReason.trim(),
        }),
      });
      setFlash('ادغام انجام شد');
      setShowMerge(false);
      setMergeReason('');
      setMergeTargetId(null);
      router.replace(`/inbox/${mergeTargetId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ادغام');
    } finally {
      setBusy(false);
    }
  }

  async function confirmSplit() {
    if (splitIds.length === 0 || splitReason.trim().length < 3) return;
    if (
      !window.confirm(
        `${splitIds.length} مقاله به Event جدید منتقل می‌شود. ادامه؟`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ newEvent: { id: string } }>(`/events/${id}/split`, {
        method: 'POST',
        body: JSON.stringify({
          articleIds: splitIds,
          reason: splitReason.trim(),
          newHeadline: splitHeadline.trim() || undefined,
        }),
      });
      setFlash('جداسازی انجام شد');
      setShowSplit(false);
      setSplitIds([]);
      setSplitReason('');
      await load();
      if (res.data?.newEvent?.id) {
        window.setTimeout(() => router.push(`/inbox/${res.data.newEvent.id}`), 700);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در جداسازی');
    } finally {
      setBusy(false);
    }
  }

  const latest = event?.scores?.[0];
  const displayScore =
    event?.effectiveFinalScore ?? latest?.finalScore ?? event?.importanceScore;
  const decided =
    event?.status === 'APPROVED' ||
    event?.status === 'SELECTED' ||
    event?.status === 'REJECTED';

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 pb-32 pt-5" dir="rtl">
      <Link
        href="/inbox"
        className="inline-flex items-center gap-1 text-xs text-fog/55 hover:text-fog/80"
      >
        <span aria-hidden>→</span> بازگشت به inbox
      </Link>

      {!event && !error ? (
        <div className="mt-8 animate-pulse space-y-3">
          <div className="h-6 w-4/5 rounded bg-fog/10" />
          <div className="h-4 w-full rounded bg-fog/5" />
          <div className="h-4 w-2/3 rounded bg-fog/5" />
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {flash ? (
        <p className="mt-4 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">
          {flash}
        </p>
      ) : null}

      {event ? (
        <>
          <div className="mt-4 flex items-start justify-between gap-3">
            <h1 className="font-display text-xl font-bold leading-snug">{event.title}</h1>
            <span className="shrink-0 rounded-md bg-accent/20 px-2.5 py-1 text-sm font-bold text-accent">
              {displayScore != null
                ? Math.round(displayScore).toLocaleString('fa-IR')
                : '—'}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge
              label={labelEventStatus(event.status)}
              tone={eventStatusTone(event.status)}
            />
            <StatusBadge label={labelCategory(event.category)} />
            <StatusBadge label={labelScope(event.scope)} />
            <StatusBadge label={labelOfficial(event.officialStatus)} />
            {(latest?.recommendation ?? event.recommendation) ? (
              <StatusBadge
                label={labelRecommendation(
                  latest?.recommendation ?? event.recommendation,
                )}
                tone="ok"
              />
            ) : null}
            {event.activeOverride ? (
              <StatusBadge label="امتیاز دستی" tone="warn" />
            ) : null}
          </div>

          {event.summary ? (
            <p className="mt-4 text-sm leading-7 text-fog/85">{event.summary}</p>
          ) : null}

          {(event.latestDevelopment?.summary || event.latestDevelopmentSummary) ? (
            <p className="mt-3 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-xs leading-6 text-fog/75">
              <span className="font-semibold text-accent">آخرین تحول: </span>
              {event.latestDevelopment?.summary ?? event.latestDevelopmentSummary}
              {event.eventAction ? (
                <span className="mt-1 block text-[11px] text-fog/45">{event.eventAction}</span>
              ) : null}
            </p>
          ) : null}

          <div className="mt-2 text-[11px] text-fog/45">
            {(event.independentSourceCount ?? event.articleCount)?.toLocaleString('fa-IR')} منبع
            مستقل · {(event.articleCount ?? 0).toLocaleString('fa-IR')} مقاله
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void reextract()}
              className="rounded-lg border border-sky-400/40 px-3 py-1.5 text-[11px] text-sky-200 disabled:opacity-40"
            >
              استخراج مجدد
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void score()}
              className="rounded-lg border border-accent/40 px-3 py-1.5 text-[11px] text-accent disabled:opacity-40"
            >
              امتیاز مجدد
            </button>
          </div>

          <section className="mt-5 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-fog/10 bg-black/15 px-2 py-2">
              <div className="text-[10px] text-fog/45">اهمیت</div>
              <div className="text-sm font-semibold text-fog/90">
                {latest?.importanceScore != null
                  ? Math.round(latest.importanceScore).toLocaleString('fa-IR')
                  : '—'}
              </div>
            </div>
            <div className="rounded-lg border border-fog/10 bg-black/15 px-2 py-2">
              <div className="text-[10px] text-fog/45">اعتبار</div>
              <div className="text-sm font-semibold text-fog/90">
                {(latest?.credibilityScore ?? event.credibilityScore) != null
                  ? Math.round(
                      Number(latest?.credibilityScore ?? event.credibilityScore),
                    ).toLocaleString('fa-IR')
                  : '—'}
              </div>
            </div>
            <div className="rounded-lg border border-fog/10 bg-black/15 px-2 py-2">
              <div className="text-[10px] text-fog/45">پادکست</div>
              <div className="text-sm font-semibold text-fog/90">
                {(latest?.podcastValueScore ?? event.podcastValueScore) != null
                  ? Math.round(
                      Number(latest?.podcastValueScore ?? event.podcastValueScore),
                    ).toLocaleString('fa-IR')
                  : '—'}
              </div>
            </div>
          </section>

          {latest?.reasons && latest.reasons.length > 0 ? (
            <section className="mt-4">
              <h2 className="text-xs font-semibold text-fog/50">دلایل امتیاز</h2>
              <ul className="mt-2 space-y-1 text-xs leading-6 text-fog/70">
                {latest.reasons.slice(0, 6).map((r) => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-4 rounded-xl border border-fog/10 bg-black/10 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold text-fog/50">override سردبیر</h2>
              <button
                type="button"
                className="text-[11px] text-accent"
                onClick={() => setShowOverride((v) => !v)}
              >
                {showOverride ? 'بستن' : 'تنظیم دستی'}
              </button>
            </div>
            {event.activeOverride ? (
              <p className="mt-2 text-xs leading-6 text-fog/70">
                امتیاز دستی:{' '}
                {Math.round(event.activeOverride.overriddenFinalScore).toLocaleString(
                  'fa-IR',
                )}{' '}
                (خودکار{' '}
                {Math.round(event.activeOverride.automaticFinalScore).toLocaleString(
                  'fa-IR',
                )}
                ) — {event.activeOverride.reason}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void revokeOverride()}
                  className="mr-2 text-amber-300 underline disabled:opacity-40"
                >
                  لغو
                </button>
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-fog/45">
                امتیاز فعلی از فرمول hybrid است. در صورت نیاز دستی عوض کنید.
              </p>
            )}
            {showOverride ? (
              <div className="mt-3 space-y-2">
                <label className="block text-[11px] text-fog/55">
                  امتیاز نهایی (۰–۱۰۰)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={overrideScore}
                    onChange={(e) => setOverrideScore(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-fog/15 bg-black/20 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-[11px] text-fog/55">
                  دلیل (الزامی)
                  <input
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-fog/15 bg-black/20 px-3 py-2 text-sm"
                    placeholder="مثلاً تیتر اصلی امشب"
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || overrideReason.trim().length < 3}
                  onClick={() => void applyOverride()}
                  className="w-full rounded-lg bg-accent/90 py-2 text-xs font-semibold text-ink disabled:opacity-40"
                >
                  اعمال override
                </button>
              </div>
            ) : null}
          </section>

          {(event.conflicts?.length ?? 0) > 0 ? (
            <section className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-3">
              <h2 className="text-xs font-semibold text-amber-200">تناقض گزارش‌شده</h2>
              <ul className="mt-2 space-y-1 text-xs text-amber-100/80">
                {event.conflicts!.map((c) => (
                  <li key={c.id}>
                    {c.conflictType} · {labelEventStatus(c.status)}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-amber-100/60">
                قبل از تأیید، منابع را مقایسه کنید.
              </p>
            </section>
          ) : null}

          {latest?.ruleHits && latest.ruleHits.length > 0 ? (
            <section className="mt-6">
              <h2 className="text-xs font-semibold text-fog/50">قوانین امتیاز</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {latest.ruleHits.map((hit) => (
                  <span
                    key={hit}
                    className="rounded-md border border-fog/15 px-2 py-0.5 text-[11px] text-fog/70"
                  >
                    {hit}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold text-fog/50">منابع خبر</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-[11px] text-accent underline"
                  onClick={() => {
                    setShowMerge((v) => !v);
                    setShowSplit(false);
                  }}
                >
                  ادغام
                </button>
                <button
                  type="button"
                  className="text-[11px] text-accent underline"
                  onClick={() => {
                    setShowSplit((v) => !v);
                    setShowMerge(false);
                  }}
                >
                  جداسازی
                </button>
              </div>
            </div>

            {showMerge ? (
              <div className="mt-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-3 text-xs">
                <p className="text-amber-100/80">
                  Event فعلی به‌عنوان ثانویه در Event مقصد ادغام می‌شود (وضعیت MERGED).
                </p>
                <input
                  value={mergeQuery}
                  onChange={(e) => setMergeQuery(e.target.value)}
                  placeholder="جست‌وجوی Event مقصد…"
                  className="mt-2 w-full rounded-lg border border-fog/15 bg-black/20 px-3 py-2 text-sm outline-none"
                />
                <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto">
                  {mergeHits.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        onClick={() => setMergeTargetId(h.id)}
                        className={`w-full rounded-lg px-2 py-1.5 text-right ${
                          mergeTargetId === h.id ? 'bg-accent/20' : 'hover:bg-black/20'
                        }`}
                      >
                        {h.title}
                      </button>
                    </li>
                  ))}
                </ul>
                <input
                  value={mergeReason}
                  onChange={(e) => setMergeReason(e.target.value)}
                  placeholder="دلیل ادغام (اجباری)"
                  className="mt-2 w-full rounded-lg border border-fog/15 bg-black/20 px-3 py-2 text-sm outline-none"
                />
                <button
                  type="button"
                  disabled={busy || !mergeTargetId || mergeReason.trim().length < 3}
                  onClick={() => void confirmMerge()}
                  className="mt-2 w-full rounded-xl bg-amber-400/90 py-2.5 text-sm font-semibold text-ink disabled:opacity-40"
                >
                  تأیید ادغام
                </button>
              </div>
            ) : null}

            {showSplit ? (
              <div className="mt-2 rounded-xl border border-sky-400/25 bg-sky-400/10 px-3 py-3 text-xs">
                <p className="text-sky-100/80">
                  حداقل یک مقاله باید روی Event فعلی بماند. دلیل اجباری است.
                </p>
                <ul className="mt-2 space-y-1">
                  {(event.articles ?? []).map((link, idx) => {
                    const aid = link.articleId ?? link.article?.id;
                    if (!aid) return null;
                    const checked = splitIds.includes(aid);
                    return (
                      <li key={aid + idx}>
                        <label className="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-1 hover:bg-black/15">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setSplitIds((prev) =>
                                checked ? prev.filter((x) => x !== aid) : [...prev, aid],
                              )
                            }
                          />
                          <span>{link.article?.title ?? aid.slice(0, 8)}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <input
                  value={splitHeadline}
                  onChange={(e) => setSplitHeadline(e.target.value)}
                  placeholder="عنوان Event جدید (اختیاری)"
                  className="mt-2 w-full rounded-lg border border-fog/15 bg-black/20 px-3 py-2 text-sm outline-none"
                />
                <input
                  value={splitReason}
                  onChange={(e) => setSplitReason(e.target.value)}
                  placeholder="دلیل جداسازی (اجباری)"
                  className="mt-2 w-full rounded-lg border border-fog/15 bg-black/20 px-3 py-2 text-sm outline-none"
                />
                <button
                  type="button"
                  disabled={busy || splitIds.length === 0 || splitReason.trim().length < 3}
                  onClick={() => void confirmSplit()}
                  className="mt-2 w-full rounded-xl bg-sky-400/90 py-2.5 text-sm font-semibold text-ink disabled:opacity-40"
                >
                  تأیید جداسازی
                </button>
              </div>
            ) : null}

            <ul className="mt-2 space-y-2">
              {(event.articles ?? []).length === 0 ? (
                <li className="text-xs text-fog/45">مقاله‌ای متصل نیست</li>
              ) : (
                (event.articles ?? []).map((link, idx) => {
                  const url = link.article?.canonicalUrl;
                  const title = link.article?.title ?? 'بدون عنوان';
                  return (
                    <li
                      key={idx}
                      className="rounded-lg border border-fog/10 bg-black/10 px-3 py-2 text-xs"
                    >
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-accent underline-offset-2 hover:underline"
                        >
                          {title}
                        </a>
                      ) : (
                        <div className="text-fog/80">{title}</div>
                      )}
                      <div className="mt-1 flex flex-wrap gap-1.5 text-fog/45">
                        <StatusBadge label={labelArticleRole(link.role)} tone="accent" />
                        {link.relationshipDecision === 'NEW_DEVELOPMENT' ||
                        link.role === 'NEW_DEVELOPMENT' ? (
                          <StatusBadge label="تحول جدید" tone="ok" />
                        ) : null}
                        {link.role === 'CONFLICTING' ? (
                          <StatusBadge label="تناقض" tone="danger" />
                        ) : null}
                        <span>
                          {link.article?.source?.name ?? 'منبع'}
                          {link.similarityScore != null
                            ? ` · شباهت ${Math.round(link.similarityScore * 100)}٪`
                            : null}
                        </span>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </section>

          {(event.timelineItems?.length ?? 0) > 0 ? (
            <section className="mt-6">
              <h2 className="text-xs font-semibold text-fog/50">Timeline رویداد</h2>
              <ol className="mt-2 space-y-2 border-r border-fog/15 pr-3">
                {event.timelineItems!.map((item) => (
                  <li key={item.id} className="text-xs leading-6 text-fog/75">
                    <div className="font-medium text-fog/90">{item.summary}</div>
                    <div className="text-[10px] text-fog/40">
                      {item.action ?? item.developmentType}
                      {item.occurredAt || item.createdAt
                        ? ` · ${formatJalali(item.occurredAt ?? item.createdAt)}`
                        : null}
                      {item.isMajorDevelopment ? ' · مهم' : null}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className="mt-6">
            <h2 className="text-xs font-semibold text-fog/50">یادداشت سردبیر</h2>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-lg border border-fog/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-accent/40"
              placeholder="یادداشت کوتاه برای تیم…"
            />
            <button
              type="button"
              disabled={busy || !note.trim()}
              onClick={() => void saveNote()}
              className="mt-2 text-xs text-accent underline disabled:opacity-40"
            >
              ذخیره یادداشت
            </button>
            <ul className="mt-3 space-y-2">
              {(event.notes ?? []).map((n) => (
                <li key={n.id} className="rounded-lg bg-black/10 px-3 py-2 text-xs leading-6 text-fog/70">
                  <div>{n.body}</div>
                  {n.createdAt ? (
                    <div className="mt-1 text-[10px] text-fog/40">{formatJalali(n.createdAt)}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-fog/10 bg-[#0a2f24]/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
            <div className="mx-auto max-w-lg">
              {decided ? (
                <div className="flex gap-2">
                  <Link
                    href="/rundown"
                    className="flex-1 rounded-xl bg-accent py-3.5 text-center text-sm font-semibold text-ink"
                  >
                    Today
                  </Link>
                  <Link
                    href="/inbox"
                    className="rounded-xl border border-fog/25 px-4 py-3.5 text-sm text-fog/70"
                  >
                    inbox
                  </Link>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void decide('reject')}
                    className="flex-1 rounded-xl border border-fog/25 py-3.5 text-sm font-semibold disabled:opacity-50"
                  >
                    رد
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void score()}
                    className="rounded-xl border border-accent/40 px-3 py-3.5 text-xs text-accent disabled:opacity-50"
                    title="امتیازدهی دوباره"
                  >
                    امتیاز
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void decide('approve')}
                    className="flex-[1.4] rounded-xl bg-accent py-3.5 text-sm font-semibold text-ink disabled:opacity-50"
                  >
                    تأیید + Today
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}
