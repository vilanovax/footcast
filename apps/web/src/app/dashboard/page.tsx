'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, clearTokens, getToken } from '../../lib/api';
import { formatJalali, formatRelativeFa } from '../../lib/dates';
import {
  episodeStatusTone,
  labelEpisodeStatus,
  labelHealth,
  labelQueue,
} from '../../lib/labels';
import { StatusBadge } from '../../components/StatusBadge';
import { PageHeader, SkeletonList } from '../../components/ui';

type DashboardSummary = {
  productName?: { en?: string; fa?: string };
  sources: {
    active: number;
    errored: number;
    crawlRuns7d: number;
    crawlErrors7d: number;
    avgCrawlDurationMs: number | null;
  };
  articles: {
    discoveredToday: number;
    pending: number;
    failed: number;
    parsed: number;
  };
  episodes: { produced: number; published: number };
  costs: {
    last24h: number;
    tokens: number;
    inputTokens: number;
    outputTokens: number;
    requests: number;
  };
  latency: { aiAvgMs: number | null; crawlAvgMs: number | null };
  editorial: {
    approve: number;
    reject: number;
    total: number;
    acceptanceRatePct: number | null;
    windowDays: number;
  };
  queues: Array<{
    name: string;
    waiting: number;
    active: number;
    failed: number;
    delayed: number;
  }>;
  pipeline: {
    lastCrawlerRunAt: string | null;
    lastNewsPipelineAt: string | null;
  };
};

type ModelRow = {
  pipelineStage: string;
  provider: string;
  model: string;
  requests: number;
  tokens: number;
  estimatedCost: number;
  avgLatencyMs: number | null;
  errorRate: number | null;
};

type SourceRow = {
  id: string;
  name: string;
  isActive: boolean;
  healthStatus: string | null;
  runs: number;
  discovered: number;
  errors: number;
  successRate: number | null;
  avgDurationMs: number | null;
  articles: number;
  failedArticles: number;
};

type EpisodeCostRow = {
  episodeId: string;
  title: string;
  status: string | null;
  requests: number;
  tokens: number;
  estimatedCost: number;
};

function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits > 0 ? Math.min(digits, 2) : 0,
  }).format(n);
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `${fmtNum(n, 1)}٪`;
}

function fmtMs(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n >= 1000) return `${fmtNum(n / 1000, 1)} ث`;
  return `${fmtNum(n, 0)} ms`;
}

function healthTone(status: string | null | undefined): 'ok' | 'danger' | 'warn' | 'neutral' {
  const s = (status ?? '').toLowerCase();
  if (s === 'healthy' || s === 'ok' || s === 'سالم') return 'ok';
  if (s === 'down' || s === 'error' || s === 'قطع' || s === 'unhealthy') return 'danger';
  if (s === 'degraded' || s === 'unknown') return 'warn';
  return 'neutral';
}

export default function DashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [episodeCosts, setEpisodeCosts] = useState<EpisodeCostRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [showIdleQueues, setShowIdleQueues] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>('queues');

  const load = useCallback(async () => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [dash, modelRes, sourceRes, episodeRes] = await Promise.all([
        apiFetch<DashboardSummary>('/dashboard'),
        apiFetch<{ models: ModelRow[] }>('/reports/models?days=7'),
        apiFetch<{ sources: SourceRow[] }>('/reports/sources?days=7'),
        apiFetch<{ episodes: EpisodeCostRow[] }>('/reports/episodes?days=30'),
      ]);
      setSummary(dash.data);
      setModels(modelRes.data?.models ?? []);
      setSources(sourceRes.data?.sources ?? []);
      setEpisodeCosts(episodeRes.data?.episodes ?? []);
      setRefreshedAt(new Date());
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

  const alerts = useMemo(() => {
    if (!summary) return [] as Array<{ label: string; href: string; tone: 'danger' | 'warn' }>;
    const items: Array<{ label: string; href: string; tone: 'danger' | 'warn' }> = [];
    const failedQueues = summary.queues.filter((q) => q.failed > 0);
    for (const q of failedQueues.slice(0, 3)) {
      items.push({
        label: `${labelQueue(q.name)}: ${fmtNum(q.failed)} خطا`,
        href: '/sources',
        tone: 'danger',
      });
    }
    if (summary.articles.failed > 0) {
      items.push({
        label: `${fmtNum(summary.articles.failed)} مقاله ناموفق امروز`,
        href: '/inbox',
        tone: 'danger',
      });
    }
    if (summary.sources.errored > 0) {
      items.push({
        label: `${fmtNum(summary.sources.errored)} منبع مشکل‌دار`,
        href: '/sources',
        tone: 'warn',
      });
    }
    return items;
  }, [summary]);

  const sortedQueues = useMemo(() => {
    if (!summary) return [];
    return [...summary.queues].sort((a, b) => {
      const score = (q: (typeof summary.queues)[0]) =>
        q.failed * 1000 + q.active * 10 + q.waiting;
      return score(b) - score(a);
    });
  }, [summary]);

  const visibleQueues = showIdleQueues
    ? sortedQueues
    : sortedQueues.filter((q) => q.failed + q.active + q.waiting + q.delayed > 0);

  const unhealthySources = useMemo(
    () =>
      sources.filter(
        (s) =>
          !s.isActive ||
          healthTone(s.healthStatus) === 'danger' ||
          (s.errors ?? 0) > 0 ||
          (s.successRate != null && s.successRate < 0.7),
      ),
    [sources],
  );

  const title = summary?.productName?.fa ?? 'گزارش عملیات';

  function toggleSection(id: string) {
    setOpenSection((prev) => (prev === id ? null : id));
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 pb-24 pt-5 md:max-w-3xl" dir="rtl">
      <PageHeader
        eyebrow="گزارش عملیات"
        title={title}
        subtitle={
          refreshedAt
            ? `به‌روز ${formatRelativeFa(refreshedAt.toISOString())}`
            : 'هزینه، صف‌ها و سلامت منابع'
        }
        action={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
          >
            {loading ? '…' : 'بروزرسانی'}
          </button>
        }
      />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <QuickLink href="/inbox" label="inbox" hint="بررسی خبر" />
        <QuickLink href="/sources" label="منابع" hint="خزش" />
        <QuickLink href="/admin/clustering-evaluation" label="کلاستر" hint="ارزیابی" />
        <QuickLink href="/podcasts" label="پادکست" hint="اپیزود" />
      </div>

      {error ? (
        <p className="mb-3 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {loading && !summary ? <SkeletonList rows={4} /> : null}

      {summary ? (
        <div className="fn-fade-in space-y-4">
          {alerts.length > 0 ? (
            <section className="space-y-1.5">
              {alerts.map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-xs ${
                    a.tone === 'danger'
                      ? 'border-red-400/30 bg-red-400/10 text-red-100'
                      : 'border-amber-400/30 bg-amber-400/10 text-amber-100'
                  }`}
                >
                  <span>{a.label}</span>
                  <span className="text-[10px] opacity-70">مشاهده ←</span>
                </Link>
              ))}
            </section>
          ) : (
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2.5 text-xs text-emerald-100">
              هشدار فعالی نیست — صف‌ها و منابع در وضعیت عادی‌اند.
            </div>
          )}

          <section className="grid grid-cols-2 gap-2">
            <Kpi
              label="مقالات امروز"
              value={fmtNum(summary.articles.discoveredToday)}
              hint={`صف ${fmtNum(summary.articles.pending)}`}
              alert={summary.articles.failed > 0}
              alertText={`${fmtNum(summary.articles.failed)} ناموفق`}
            />
            <Kpi
              label="هزینه AI"
              value={`$${fmtNum(summary.costs.last24h, 2)}`}
              hint={`${fmtNum(summary.costs.requests)} درخواست · ۲۴س`}
            />
            <Kpi
              label="منابع فعال"
              value={fmtNum(summary.sources.active)}
              hint={
                summary.sources.errored > 0
                  ? `${fmtNum(summary.sources.errored)} مشکل‌دار`
                  : 'همه سالم'
              }
              alert={summary.sources.errored > 0}
            />
            <Kpi
              label="پذیرش تحریریه"
              value={fmtPct(summary.editorial.acceptanceRatePct)}
              hint={`${fmtNum(summary.editorial.approve)} تأیید / ${fmtNum(summary.editorial.reject)} رد`}
            />
          </section>

          <section className="grid grid-cols-3 gap-1.5">
            <MiniStat label="توکن ۲۴س" value={fmtNum(summary.costs.tokens)} />
            <MiniStat label="تأخیر AI" value={fmtMs(summary.latency.aiAvgMs)} />
            <MiniStat
              label="اپیزود"
              value={`${fmtNum(summary.episodes.published)}/${fmtNum(summary.episodes.produced)}`}
            />
          </section>

          <p className="text-[10px] text-fog/40">
            آخرین خزش {formatRelativeFa(summary.pipeline.lastCrawlerRunAt)} · AI{' '}
            {formatRelativeFa(summary.pipeline.lastNewsPipelineAt)}
            {summary.pipeline.lastCrawlerRunAt ? (
              <span className="text-fog/30">
                {' '}
                ({formatJalali(summary.pipeline.lastCrawlerRunAt)})
              </span>
            ) : null}
          </p>

          <Collapsible
            id="queues"
            title="وضعیت صف‌ها"
            open={openSection === 'queues'}
            onToggle={() => toggleSection('queues')}
            badge={
              sortedQueues.some((q) => q.failed > 0)
                ? `${fmtNum(sortedQueues.reduce((s, q) => s + q.failed, 0))} خطا`
                : undefined
            }
            badgeTone="danger"
          >
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowIdleQueues((v) => !v)}
                className="text-[10px] text-fog/45 underline"
              >
                {showIdleQueues ? 'فقط صف‌های فعال' : 'نمایش همه'}
              </button>
            </div>
            {visibleQueues.length === 0 ? (
              <p className="py-3 text-center text-xs text-fog/40">همه صف‌ها خالی‌اند</p>
            ) : (
              <ul className="space-y-1.5">
                {visibleQueues.map((q) => {
                  const hot = q.failed > 0 || q.active > 0;
                  return (
                    <li
                      key={q.name}
                      className={`rounded-xl border px-3 py-2.5 ${
                        q.failed > 0
                          ? 'border-red-400/30 bg-red-400/10'
                          : hot
                            ? 'border-accent/25 bg-accent/5'
                            : 'border-fog/10 bg-black/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-fog/90">
                          {labelQueue(q.name)}
                        </span>
                        {q.failed > 0 ? (
                          <span className="text-[11px] font-semibold tabular-nums text-red-200">
                            {fmtNum(q.failed)} خطا
                          </span>
                        ) : q.active > 0 ? (
                          <span className="text-[11px] text-accent">
                            {fmtNum(q.active)} فعال
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1.5 flex gap-3 text-[10px] text-fog/45">
                        <span>منتظر {fmtNum(q.waiting)}</span>
                        <span>فعال {fmtNum(q.active)}</span>
                        <span>خطا {fmtNum(q.failed)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Collapsible>

          <Collapsible
            id="models"
            title="عملکرد مدل"
            open={openSection === 'models'}
            onToggle={() => toggleSection('models')}
            badge="۷ روز"
          >
            {models.length === 0 ? (
              <EmptyHint text="هنوز درخواست AI ثبت نشده" />
            ) : (
              <ul className="space-y-2">
                {models.map((m) => (
                  <li
                    key={`${m.pipelineStage}-${m.provider}-${m.model}`}
                    className="rounded-xl border border-fog/10 bg-black/20 px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold text-fog/90">{m.model}</div>
                        <div className="mt-0.5 text-[10px] text-fog/40">
                          {m.provider} · {m.pipelineStage}
                        </div>
                      </div>
                      <div className="text-left text-[11px] tabular-nums text-accent">
                        ${fmtNum(m.estimatedCost, 4)}
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[10px] text-fog/50">
                      <StatCell label="درخواست" value={fmtNum(m.requests)} />
                      <StatCell label="توکن" value={fmtNum(m.tokens)} />
                      <StatCell label="تأخیر" value={fmtMs(m.avgLatencyMs)} />
                      <StatCell
                        label="خطا"
                        value={m.errorRate === null ? '—' : fmtPct(m.errorRate * 100)}
                        alert={(m.errorRate ?? 0) > 0.05}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Collapsible>

          <Collapsible
            id="episodes"
            title="هزینه اپیزود"
            open={openSection === 'episodes'}
            onToggle={() => toggleSection('episodes')}
            badge="۳۰ روز"
          >
            {episodeCosts.length === 0 ? (
              <EmptyHint
                text="هنوز هزینه اپیزود ثبت نشده"
                action={
                  <Link
                    href="/podcasts"
                    className="mt-2 inline-block text-[11px] text-accent underline"
                  >
                    ساخت پادکست
                  </Link>
                }
              />
            ) : (
              <ul className="space-y-2">
                {episodeCosts.map((ep) => (
                  <li key={ep.episodeId}>
                    <Link
                      href={`/podcasts/${ep.episodeId}`}
                      className="block rounded-xl border border-fog/10 bg-black/20 px-3 py-2.5 transition hover:border-accent/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium text-fog/90">
                            {ep.title}
                          </div>
                          <div className="mt-1">
                            <StatusBadge
                              label={labelEpisodeStatus(ep.status)}
                              tone={episodeStatusTone(ep.status)}
                            />
                          </div>
                        </div>
                        <div className="shrink-0 text-left text-xs tabular-nums text-accent">
                          ${fmtNum(ep.estimatedCost, 4)}
                        </div>
                      </div>
                      <div className="mt-1.5 text-[10px] text-fog/40">
                        {fmtNum(ep.requests)} درخواست · {fmtNum(ep.tokens)} توکن
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Collapsible>

          <Collapsible
            id="sources"
            title="عملکرد منابع"
            open={openSection === 'sources'}
            onToggle={() => toggleSection('sources')}
            badge={
              unhealthySources.length > 0
                ? `${fmtNum(unhealthySources.length)} نیازمند توجه`
                : '۷ روز'
            }
            badgeTone={unhealthySources.length > 0 ? 'warn' : undefined}
          >
            {sources.length === 0 ? (
              <EmptyHint text="منبعی ثبت نشده" />
            ) : (
              <ul className="space-y-2">
                {[...sources]
                  .sort((a, b) => {
                    const rank = (s: SourceRow) =>
                      (healthTone(s.healthStatus) === 'danger' ? 100 : 0) +
                      (s.errors ?? 0) * 10 +
                      (!s.isActive ? 5 : 0);
                    return rank(b) - rank(a);
                  })
                  .map((s) => {
                    const tone = healthTone(s.healthStatus);
                    return (
                      <li
                        key={s.id}
                        className={`rounded-xl border px-3 py-2.5 ${
                          tone === 'danger'
                            ? 'border-red-400/25 bg-red-400/5'
                            : 'border-fog/10 bg-black/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-fog/90">
                              {s.name}
                              {!s.isActive ? (
                                <span className="mr-1 text-fog/35">· غیرفعال</span>
                              ) : null}
                            </div>
                            <div className="mt-1">
                              <StatusBadge
                                label={labelHealth(s.healthStatus)}
                                tone={tone}
                              />
                            </div>
                          </div>
                          <div className="shrink-0 text-left text-[11px] tabular-nums text-fog/55">
                            {s.successRate === null
                              ? '—'
                              : fmtPct(s.successRate * 100)}
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[10px] text-fog/45">
                          <StatCell label="اجرا" value={fmtNum(s.runs)} />
                          <StatCell label="کشف" value={fmtNum(s.discovered)} />
                          <StatCell
                            label="خطا"
                            value={fmtNum(s.errors)}
                            alert={(s.errors ?? 0) > 0}
                          />
                          <StatCell label="مدت" value={fmtMs(s.avgDurationMs)} />
                        </div>
                      </li>
                    );
                  })}
              </ul>
            )}
            <Link
              href="/sources"
              className="mt-3 block text-center text-[11px] text-accent underline"
            >
              مدیریت منابع
            </Link>
          </Collapsible>
        </div>
      ) : null}
    </main>
  );
}

function QuickLink({
  href,
  label,
  hint,
}: {
  href: string;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="shrink-0 rounded-xl border border-fog/12 bg-black/25 px-3 py-2 transition hover:border-accent/35"
    >
      <div className="text-[12px] font-semibold text-fog/90">{label}</div>
      <div className="text-[10px] text-fog/40">{hint}</div>
    </Link>
  );
}

function Kpi({
  label,
  value,
  hint,
  alert,
  alertText,
}: {
  label: string;
  value: string;
  hint?: string;
  alert?: boolean;
  alertText?: string;
}) {
  return (
    <div
      className={`rounded-2xl border px-3 py-3 ${
        alert ? 'border-red-400/25 bg-red-400/5' : 'border-fog/10 bg-black/20'
      }`}
    >
      <div className="text-[10px] text-fog/45">{label}</div>
      <div className="mt-1 font-display text-xl font-bold tabular-nums text-accent">
        {value}
      </div>
      {alert && alertText ? (
        <div className="mt-1 text-[10px] text-red-200">{alertText}</div>
      ) : hint ? (
        <div className="mt-1 text-[10px] text-fog/40">{hint}</div>
      ) : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-fog/10 bg-black/15 px-2 py-2 text-center">
      <div className="text-[9px] text-fog/40">{label}</div>
      <div className="mt-0.5 text-xs font-semibold tabular-nums text-fog/85">{value}</div>
    </div>
  );
}

function StatCell({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div>
      <div className="text-fog/35">{label}</div>
      <div
        className={`mt-0.5 tabular-nums ${
          alert ? 'font-semibold text-red-200' : 'text-fog/70'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Collapsible({
  id,
  title,
  open,
  onToggle,
  badge,
  badgeTone,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  badge?: string;
  badgeTone?: 'danger' | 'warn';
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-fog/10 bg-black/15">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`dash-${id}`}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-right"
      >
        <span className="text-sm font-semibold text-fog/85">{title}</span>
        <span className="flex items-center gap-2">
          {badge ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] ${
                badgeTone === 'danger'
                  ? 'bg-red-400/15 text-red-200'
                  : badgeTone === 'warn'
                    ? 'bg-amber-400/15 text-amber-200'
                    : 'bg-fog/10 text-fog/50'
              }`}
            >
              {badge}
            </span>
          ) : null}
          <span className="text-fog/40">{open ? '▴' : '▾'}</span>
        </span>
      </button>
      {open ? (
        <div id={`dash-${id}`} className="fn-fade-in border-t border-fog/10 px-3 pb-3 pt-2">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function EmptyHint({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-fog/15 px-3 py-6 text-center">
      <p className="text-xs text-fog/45">{text}</p>
      {action}
    </div>
  );
}
