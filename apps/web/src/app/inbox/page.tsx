'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, clearTokens, getToken } from '../../lib/api';
import {
  eventStatusTone,
  labelCategory,
  labelEventStatus,
  labelRecommendation,
  labelScope,
} from '../../lib/labels';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { StatusBadge } from '../../components/StatusBadge';
import { CoveragePanel } from '../../components/CoveragePanel';
import { WorkflowGuide } from '../../components/WorkflowGuide';
import { EmptyState, PageHeader, SkeletonList } from '../../components/ui';
import { inboxAutomationBadges } from '../../lib/automation-ui';

type SourceOption = { id: string; name: string };

type InboxItem = {
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
  metadata?: Record<string, unknown> | null;
  latestScore?: {
    finalScore?: number;
    credibilityScore?: number;
    podcastValueScore?: number;
    recommendation?: string;
  } | null;
  activeOverride?: { overriddenFinalScore?: number } | null;
};

type BulkResult = {
  succeeded?: number;
  failed?: number;
  note?: string;
};

const SELECT_CLASS =
  'w-full appearance-none rounded-xl border border-fog/12 bg-black/25 px-3 py-2.5 text-xs text-fog/90 outline-none transition focus:border-accent/45';

function paramOr(
  sp: { get(name: string): string | null },
  key: string,
  fallback = '',
): string {
  return sp.get(key) ?? fallback;
}

function isPlaceholderSummary(text?: string | null): boolean {
  if (!text) return true;
  return /extract the news|card json|placeholder|lorem/i.test(text);
}

export default function InboxPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto min-h-screen max-w-3xl px-4 py-6" dir="rtl">
          <SkeletonList rows={6} />
        </main>
      }
    >
      <InboxPageInner />
    </Suspense>
  );
}

function InboxPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState(() => paramOr(searchParams, 'q'));
  const [status, setStatus] = useState(() =>
    paramOr(searchParams, 'status', 'NEEDS_REVIEW'),
  );
  const [category, setCategory] = useState(() => paramOr(searchParams, 'category'));
  const [scope, setScope] = useState(() => paramOr(searchParams, 'scope'));
  const [sourceId, setSourceId] = useState(() => paramOr(searchParams, 'sourceId'));
  const [minFinalScore, setMinFinalScore] = useState(() =>
    paramOr(searchParams, 'minFinalScore'),
  );
  const [recommendation, setRecommendation] = useState(() =>
    paramOr(searchParams, 'recommendation'),
  );
  const [automation, setAutomation] = useState(() =>
    paramOr(searchParams, 'automation'),
  );
  const [todayIds, setTodayIds] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [crawlMsg, setCrawlMsg] = useState<string | null>(null);
  const [coverageFilterIds, setCoverageFilterIds] = useState<string[] | null>(
    null,
  );
  const [coverageFilterLabel, setCoverageFilterLabel] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const debouncedQ = useDebouncedValue(q, 400);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (status && status !== 'NEEDS_REVIEW') {
      chips.push({
        key: 'status',
        label: labelEventStatus(status),
        clear: () => setStatus('NEEDS_REVIEW'),
      });
    }
    if (category) {
      chips.push({
        key: 'category',
        label: labelCategory(category),
        clear: () => setCategory(''),
      });
    }
    if (scope) {
      chips.push({
        key: 'scope',
        label: labelScope(scope),
        clear: () => setScope(''),
      });
    }
    if (sourceId) {
      const name = sources.find((s) => s.id === sourceId)?.name ?? 'منبع';
      chips.push({ key: 'source', label: name, clear: () => setSourceId('') });
    }
    if (minFinalScore) {
      chips.push({
        key: 'score',
        label: `امتیاز ≥ ${minFinalScore}`,
        clear: () => setMinFinalScore(''),
      });
    }
    if (recommendation) {
      chips.push({
        key: 'rec',
        label: labelRecommendation(recommendation),
        clear: () => setRecommendation(''),
      });
    }
    if (automation === 'important') {
      chips.push({
        key: 'auto',
        label: 'خبرهای مهم',
        clear: () => setAutomation(''),
      });
    } else if (automation === 'suggested') {
      chips.push({
        key: 'auto',
        label: 'پیشنهاد سیستم',
        clear: () => setAutomation(''),
      });
    }
    return chips;
  }, [
    status,
    category,
    scope,
    sourceId,
    minFinalScore,
    recommendation,
    automation,
    sources,
  ]);

  const load = useCallback(async () => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        pageSize: coverageFilterIds ? '100' : '40',
      });
      if (debouncedQ.trim()) params.set('q', debouncedQ.trim());
      if (status) params.set('status', status);
      if (category) params.set('category', category);
      if (scope) params.set('scope', scope);
      if (sourceId) params.set('sourceId', sourceId);
      if (minFinalScore) params.set('minFinalScore', minFinalScore);
      if (recommendation) params.set('recommendation', recommendation);
      if (automation) params.set('automation', automation);
      const [res, todayRes] = await Promise.all([
        apiFetch<InboxItem[]>(`/editorial/inbox?${params}`),
        apiFetch<{ eventIds?: string[] }>('/rundown/today/event-ids').catch(
          () => ({ data: { eventIds: [] as string[] } }),
        ),
      ]);
      setItems(res.data ?? []);
      setTotal(res.meta?.total ?? res.data?.length ?? 0);
      setTodayIds(new Set(todayRes.data?.eventIds ?? []));
      setSelected(new Set());
      setToolsOpen(false);

      const next = new URLSearchParams(params);
      next.delete('pageSize');
      const qs = next.toString();
      const target = qs ? `/inbox?${qs}` : '/inbox';
      const current = `${window.location.pathname}${window.location.search}`;
      if (current !== target) {
        router.replace(target, { scroll: false });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'خطا';
      setError(message);
      if (!getToken() || /invalid refresh|refresh token expired/i.test(message)) {
        clearTokens();
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [
    debouncedQ,
    status,
    category,
    scope,
    sourceId,
    minFinalScore,
    recommendation,
    automation,
    coverageFilterIds,
    router,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!getToken()) return;
    void apiFetch<SourceOption[]>('/sources?pageSize=50')
      .then((res) =>
        setSources((res.data ?? []).map((s) => ({ id: s.id, name: s.name }))),
      )
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 4200);
    return () => window.clearTimeout(t);
  }, [flash]);

  const visibleItems = useMemo(() => {
    const allow = coverageFilterIds ? new Set(coverageFilterIds) : null;
    const list = allow ? items.filter((i) => allow.has(i.id)) : [...items];
    // Highest score first so editor sees pick candidates at the top
    list.sort((a, b) => {
      const sa =
        a.effectiveFinalScore ??
        a.latestScore?.finalScore ??
        a.importanceScore ??
        0;
      const sb =
        b.effectiveFinalScore ??
        b.latestScore?.finalScore ??
        b.importanceScore ??
        0;
      return sb - sa;
    });
    return list;
  }, [items, coverageFilterIds]);

  const allIds = useMemo(() => visibleItems.map((i) => i.id), [visibleItems]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const selectedCount = selected.size;
  const selecting = selectedCount > 0;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  function resetFilters() {
    setCategory('');
    setScope('');
    setSourceId('');
    setMinFinalScore('');
    setRecommendation('');
    setAutomation('');
    setStatus('NEEDS_REVIEW');
    setQ('');
  }

  async function crawlNow() {
    setCrawling(true);
    setCrawlMsg(null);
    setError(null);
    try {
      const res = await apiFetch<{
        totalSources: number;
        queued: number;
        skipped: number;
      }>('/sources/crawl-all', { method: 'POST', body: '{}' });
      setCrawlMsg(
        `خزش شروع شد: ${res.data.queued.toLocaleString('fa-IR')} منبع در صف` +
          (res.data.skipped
            ? ` · ${res.data.skipped.toLocaleString('fa-IR')} در حال اجرا/رد`
            : '') +
          ' — چند لحظه بعد لیست را تازه کنید',
      );
      window.setTimeout(() => void load(), 8000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خزش ناموفق');
    } finally {
      setCrawling(false);
    }
  }

  async function runBulk(
    label: string,
    path: string,
    body: Record<string, unknown>,
    confirmMsg?: string,
  ) {
    const eventIds = [...selected];
    if (eventIds.length === 0) return;
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    setError(null);
    setFlash(null);
    try {
      const res = await apiFetch<BulkResult>(path, {
        method: 'POST',
        body: JSON.stringify({ ...body, eventIds }),
      });
      const ok = res.data?.succeeded ?? 0;
      const fail = res.data?.failed ?? 0;
      setFlash(
        fail
          ? `${label}: ${ok} موفق · ${fail} ناموفق`
          : `${label} شد — ${ok.toLocaleString('fa-IR')} خبر`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : `خطا در ${label}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className={`mx-auto min-h-screen max-w-lg px-4 pt-5 ${
        selecting ? 'pb-44' : 'pb-24'
      }`}
      dir="rtl"
    >
      <PageHeader
        title="inbox"
        subtitle={`${total.toLocaleString('fa-IR')} خبر · تأیید → Today`}
        action={
          <button
            type="button"
            id="inbox-crawl-cta"
            disabled={crawling}
            onClick={() => void crawlNow()}
            className="rounded-xl bg-accent px-3 py-2 text-[11px] font-semibold text-ink shadow-sm shadow-accent/20 transition hover:brightness-105 disabled:opacity-50"
          >
            {crawling ? 'در حال خزش…' : 'جستجوی خبر'}
          </button>
        }
      />

      <WorkflowGuide activeOverride="review" counts={{ review: total }} />

      {crawlMsg ? (
        <p className="mb-3 fn-fade-in rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-[11px] leading-5 text-accent">
          {crawlMsg}
        </p>
      ) : null}

      <CoveragePanel
        compact
        onCrawlHint={() => {
          document.getElementById('inbox-crawl-cta')?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
          document.getElementById('inbox-crawl-cta')?.focus();
        }}
        onFilter={(dimension, key, eventIds) => {
          setStatus('');
          setCoverageFilterIds(eventIds);
          setCoverageFilterLabel(`${key}`);
          setSelected(new Set());
        }}
      />

      {coverageFilterIds ? (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-accent/30 bg-accent/12 px-3 py-2 text-[11px] text-accent fn-fade-in">
          <span>
            فیلتر پوشش: {coverageFilterLabel} ·{' '}
            {visibleItems.length.toLocaleString('fa-IR')} از{' '}
            {coverageFilterIds.length.toLocaleString('fa-IR')}
          </span>
          <button
            type="button"
            className="shrink-0 rounded-lg bg-accent/20 px-2 py-1 font-medium"
            onClick={() => {
              setCoverageFilterIds(null);
              setCoverageFilterLabel(null);
            }}
          >
            پاک کردن
          </button>
        </div>
      ) : null}

      {/* Search + filter toggle */}
      <div className="sticky top-14 z-20 -mx-4 border-b border-fog/5 bg-[#0a2f24]/85 px-4 pb-3 pt-1 backdrop-blur-md">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجو در عنوان…"
              className="w-full rounded-xl border border-fog/12 bg-black/30 py-2.5 pe-3 ps-9 text-sm outline-none transition focus:border-accent/45"
              aria-label="جستجو"
            />
            <span
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-fog/35"
              aria-hidden
            >
              ⌕
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={`relative shrink-0 rounded-xl border px-3 py-2.5 text-xs font-medium transition ${
              filtersOpen || activeFilterChips.length > 0
                ? 'border-accent/40 bg-accent/15 text-accent'
                : 'border-fog/12 bg-black/25 text-fog/70'
            }`}
            aria-expanded={filtersOpen}
          >
            فیلتر
            {activeFilterChips.length > 0 ? (
              <span className="ms-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-ink">
                {activeFilterChips.length}
              </span>
            ) : null}
          </button>
        </div>

        {activeFilterChips.length > 0 && !filtersOpen ? (
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.clear}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-[11px] text-accent"
              >
                {chip.label}
                <span aria-hidden>×</span>
              </button>
            ))}
            <button
              type="button"
              onClick={resetFilters}
              className="shrink-0 px-2 text-[11px] text-fog/45 underline"
            >
              پاک کردن
            </button>
          </div>
        ) : null}

        {filtersOpen ? (
          <div className="fn-fade-in mt-3 space-y-2 rounded-2xl border border-fog/10 bg-black/25 p-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-[10px] text-fog/40">وضعیت</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="">همه</option>
                  <option value="NEEDS_REVIEW">نیاز به بررسی</option>
                  <option value="NEW">جدید</option>
                  <option value="CONFLICTED">تناقض</option>
                  <option value="VERIFIED">تأیید اولیه</option>
                  <option value="APPROVED">تأییدشده</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] text-fog/40">دسته</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="">همه</option>
                  <option value="TRANSFER">انتقال</option>
                  <option value="COACH_CHANGE">تغییر مربی</option>
                  <option value="INJURY">مصدومیت</option>
                  <option value="MATCH_RESULT">نتیجه بازی</option>
                  <option value="MATCH_PREVIEW">پیش‌بازی</option>
                  <option value="NATIONAL_TEAM">تیم ملی</option>
                  <option value="CONTRACT">قرارداد</option>
                  <option value="DISCIPLINARY">انضباطی</option>
                  <option value="OTHER">سایر</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] text-fog/40">پوشش</span>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="">ایران + اروپا</option>
                  <option value="iran">ایران</option>
                  <option value="europe">اروپا</option>
                  <option value="both">هر دو</option>
                  <option value="other">سایر</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] text-fog/40">منبع</span>
                <select
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="">همه منابع</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] text-fog/40">حداقل امتیاز</span>
                <select
                  value={minFinalScore}
                  onChange={(e) => setMinFinalScore(e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="">هر امتیازی</option>
                  <option value="70">≥ ۷۰</option>
                  <option value="60">≥ ۶۰</option>
                  <option value="45">≥ ۴۵</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] text-fog/40">پیشنهاد</span>
                <select
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="">همه</option>
                  <option value="LEAD_STORY">تیتر اول</option>
                  <option value="INCLUDE_IN_MAIN_PODCAST">پادکست اصلی</option>
                  <option value="INCLUDE_AS_BRIEF">خبر کوتاه</option>
                  <option value="NEEDS_EDITOR_REVIEW">نیاز به بررسی</option>
                  <option value="REJECT_OR_ARCHIVE">رد / بایگانی</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] text-fog/40">اتوماسیون</span>
                <select
                  value={automation}
                  onChange={(e) => setAutomation(e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="">همه</option>
                  <option value="important">خبرهای مهم</option>
                  <option value="suggested">پیشنهاد سیستم</option>
                </select>
              </label>
            </div>
            <div className="flex justify-between pt-1">
              <button
                type="button"
                onClick={resetFilters}
                className="text-[11px] text-fog/45 underline"
              >
                بازنشانی
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="rounded-lg bg-accent/90 px-3 py-1.5 text-[11px] font-semibold text-ink"
              >
                بستن
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {!loading && visibleItems.length > 0 ? (
        <div className="mb-3 mt-4 flex items-center justify-between gap-2">
          <label className="flex cursor-pointer items-center gap-2.5 text-xs text-fog/65">
            <span
              className={`flex size-5 items-center justify-center rounded-md border transition ${
                allSelected
                  ? 'border-accent bg-accent text-ink'
                  : 'border-fog/25 bg-black/20'
              }`}
            >
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="sr-only"
              />
              {allSelected ? (
                <span className="text-[11px] font-bold" aria-hidden>
                  ✓
                </span>
              ) : null}
            </span>
            انتخاب همه
          </label>
          <span className="text-[11px] tabular-nums text-fog/40">
            {items.length.toLocaleString('fa-IR')} در این صفحه
          </span>
        </div>
      ) : (
        <div className="mt-4" />
      )}

      {flash ? (
        <p
          role="status"
          className="fn-fade-in mb-3 rounded-xl border border-accent/30 bg-accent/12 px-3 py-2.5 text-xs text-accent"
        >
          {flash}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mb-3 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2.5 text-sm text-red-200"
        >
          {error}
        </p>
      ) : null}

      {loading ? <SkeletonList rows={5} /> : null}

      {!loading ? (
        <ul className="space-y-2.5">
          {visibleItems.map((item, index) => {
            const score =
              item.effectiveFinalScore ??
              item.latestScore?.finalScore ??
              item.importanceScore;
            const cred = item.latestScore?.credibilityScore ?? item.credibilityScore;
            const rec = item.latestScore?.recommendation ?? item.recommendation;
            const checked = selected.has(item.id);
            const summary =
              item.summary && !isPlaceholderSummary(item.summary) ? item.summary : null;
            return (
              <li
                key={item.id}
                style={{ animationDelay: `${Math.min(index, 8) * 28}ms` }}
                className="fn-fade-in"
              >
                <article
                  className={`group relative overflow-hidden rounded-2xl border transition duration-200 ${
                    checked
                      ? 'border-accent/55 bg-accent/[0.07] shadow-[0_0_0_1px_rgba(198,161,91,0.15)]'
                      : 'border-fog/10 bg-black/20 hover:border-fog/20'
                  }`}
                >
                  <div
                    className={`absolute inset-y-0 start-0 w-1 transition ${
                      checked ? 'bg-accent' : 'bg-transparent group-hover:bg-fog/15'
                    }`}
                    aria-hidden
                  />
                  <div className="flex gap-0 pe-3 ps-3.5">
                    <button
                      type="button"
                      onClick={() => toggleOne(item.id)}
                      className="flex shrink-0 items-start pt-3.5 pe-2"
                      aria-label={checked ? 'لغو انتخاب' : 'انتخاب خبر'}
                      aria-pressed={checked}
                    >
                      <span
                        className={`flex size-5 items-center justify-center rounded-md border transition ${
                          checked
                            ? 'border-accent bg-accent text-ink'
                            : 'border-fog/30 bg-black/30'
                        }`}
                      >
                        {checked ? (
                          <span className="text-[11px] font-bold" aria-hidden>
                            ✓
                          </span>
                        ) : null}
                      </span>
                    </button>

                    <Link
                      href={`/inbox/${item.id}`}
                      className="min-w-0 flex-1 py-3.5 active:opacity-90"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-[15px] font-semibold leading-6 text-fog/95">
                          {item.title}
                        </h2>
                        <div className="shrink-0 text-left">
                          <span className="block min-w-[2.25rem] rounded-lg bg-accent/15 px-2 py-1 text-center text-xs font-bold tabular-nums text-accent">
                            {score != null
                              ? Math.round(score).toLocaleString('fa-IR')
                              : '—'}
                          </span>
                          {item.activeOverride ? (
                            <span className="mt-0.5 block text-center text-[9px] text-amber-300/90">
                              دستی
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {summary ? (
                        <p className="mt-1.5 line-clamp-2 text-[12px] leading-6 text-fog/55">
                          {summary}
                        </p>
                      ) : (
                        <p className="mt-1.5 text-[11px] text-fog/35">
                          خلاصهٔ استخراج ناقص — استخراج مجدد پیشنهاد می‌شود
                        </p>
                      )}

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <StatusBadge
                          label={labelEventStatus(item.status)}
                          tone={eventStatusTone(item.status)}
                        />
                        <StatusBadge label={labelCategory(item.category)} tone="accent" />
                        {rec ? (
                          <StatusBadge
                            label={labelRecommendation(rec)}
                            tone={
                              rec === 'LEAD_STORY' ||
                              rec === 'INCLUDE_IN_MAIN_PODCAST'
                                ? 'ok'
                                : rec === 'INCLUDE_AS_BRIEF'
                                  ? 'accent'
                                  : rec === 'REJECT_OR_ARCHIVE'
                                    ? 'danger'
                                    : 'warn'
                            }
                          />
                        ) : null}
                        {inboxAutomationBadges({
                          recommendation: rec,
                          metadata: item.metadata,
                          inToday: todayIds.has(item.id),
                        })
                          .filter(
                            (b) =>
                              // recommendation badge already shown above
                              b.key !== 'lead' &&
                              b.key !== 'important' &&
                              b.key !== 'candidate',
                          )
                          .map((b) => (
                            <StatusBadge key={b.key} label={b.label} tone={b.tone} />
                          ))}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-fog/40">
                        <span>{labelScope(item.scope)}</span>
                        {cred != null ? (
                          <span>اعتبار {Math.round(cred).toLocaleString('fa-IR')}</span>
                        ) : null}
                        <span>
                          {(item.independentSourceCount ?? item.articleCount ?? 0).toLocaleString(
                            'fa-IR',
                          )}{' '}
                          منبع
                        </span>
                      </div>

                      {item.latestDevelopmentSummary ? (
                        <p className="mt-1.5 line-clamp-1 text-[11px] text-fog/45">
                          <span className="text-accent/80">تحول · </span>
                          {item.latestDevelopmentSummary}
                        </p>
                      ) : null}
                    </Link>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      ) : null}

      {!loading && visibleItems.length === 0 ? (
        <EmptyState
          title="خبری با این فیلتر نیست"
          description={
            coverageFilterIds
              ? 'رویدادهای این بُعد پوشش در صفحهٔ فعلی inbox نیستند — فیلتر پوشش را بردارید یا صفحه‌اندازه بزرگ‌تر بارگذاری شود.'
              : 'فیلتر را عوض کنید یا صبر کنید خزش خبر جدید بیاورد.'
          }
          action={
            coverageFilterIds ? (
              <button
                type="button"
                onClick={() => {
                  setCoverageFilterIds(null);
                  setCoverageFilterLabel(null);
                }}
                className="rounded-xl border border-fog/25 px-4 py-2 text-sm text-fog/80"
              >
                برداشتن فیلتر پوشش
              </button>
            ) : activeFilterChips.length > 0 || q ? (
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-xl border border-fog/25 px-4 py-2 text-sm text-fog/80"
              >
                بازنشانی فیلترها
              </button>
            ) : null
          }
        />
      ) : null}

      {/* Selection action sheet — covers bottom nav so nothing is clipped */}
      {selecting ? (
        <div
          className="fn-slide-up fixed inset-x-0 bottom-0 z-50 border-t border-accent/20 bg-[#071f18]/97 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl"
          role="toolbar"
          aria-label="اقدامات گروهی"
        >
          <div className="mx-auto max-w-lg px-4">
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-xs font-medium text-fog/80">
                <span className="tabular-nums text-accent">
                  {selectedCount.toLocaleString('fa-IR')}
                </span>{' '}
                خبر انتخاب‌شده
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setSelected(new Set());
                  setToolsOpen(false);
                }}
                className="text-[11px] text-fog/45 underline disabled:opacity-40"
              >
                لغو انتخاب
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void runBulk('تأیید', '/editorial/bulk/decide', {
                    decision: 'approve',
                  })
                }
                className="rounded-xl bg-accent py-3.5 text-sm font-bold text-ink shadow-sm transition active:scale-[0.98] disabled:opacity-40"
              >
                تأیید برای پادکست
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void runBulk(
                    'رد',
                    '/editorial/bulk/decide',
                    { decision: 'reject' },
                    `${selectedCount} خبر رد شود؟`,
                  )
                }
                className="rounded-xl border border-fog/20 bg-black/30 py-3.5 text-sm font-semibold text-fog/90 transition active:scale-[0.98] disabled:opacity-40"
              >
                رد
              </button>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => void runBulk('امتیاز', '/editorial/bulk/score', {})}
                className="rounded-xl border border-accent/30 py-2.5 text-[11px] font-medium text-accent disabled:opacity-40"
              >
                امتیاز
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void runBulk(
                    'استخراج مجدد',
                    '/editorial/bulk/reextract',
                    { recluster: true },
                    `استخراج AI برای ${selectedCount} خبر دوباره صف شود؟`,
                  )
                }
                className="rounded-xl border border-sky-400/35 py-2.5 text-[11px] font-medium text-sky-200 disabled:opacity-40"
              >
                استخراج مجدد
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setToolsOpen((v) => !v)}
                className="rounded-xl border border-fog/15 py-2.5 text-[11px] text-fog/60 disabled:opacity-40"
                aria-expanded={toolsOpen}
              >
                بیشتر {toolsOpen ? '▴' : '▾'}
              </button>
            </div>

            {toolsOpen ? (
              <div className="fn-fade-in mt-2 grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void runBulk(
                      'کلاستر مجدد',
                      '/editorial/bulk/recluster',
                      {},
                      `کلاسترینگ ${selectedCount} خبر دوباره اجرا شود؟`,
                    )
                  }
                  className="rounded-xl border border-fog/15 bg-black/20 py-2.5 text-[11px] text-fog/75 disabled:opacity-40"
                >
                  کلاستر مجدد
                </button>
                <Link
                  href={
                    selectedCount === 1
                      ? `/inbox/${[...selected][0]}`
                      : '/admin/clustering-evaluation'
                  }
                  className="rounded-xl border border-fog/15 bg-black/20 py-2.5 text-center text-[11px] text-fog/75"
                >
                  {selectedCount === 1 ? 'باز کردن جزئیات' : 'صفحه ارزیابی'}
                </Link>
              </div>
            ) : null}

            {busy ? (
              <p className="mt-2 text-center text-[11px] text-fog/40">در حال اجرا…</p>
            ) : null}
          </div>
        </div>
      ) : null}

    </main>
  );
}
