'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, clearTokens, getToken } from '../../lib/api';

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

function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fa-IR');
  } catch {
    return '—';
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [episodeCosts, setEpisodeCosts] = useState<EpisodeCostRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  const title = summary?.productName?.fa ?? 'داشبورد';

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 pb-16 pt-5" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-xs text-fog/55">گزارش عملکرد · فاز ۸</p>
        </div>
        <div className="flex gap-2 text-xs">
          <Link href="/inbox" className="rounded-lg border border-fog/20 px-3 py-2">
            صندوق
          </Link>
          <Link href="/podcasts" className="rounded-lg border border-fog/20 px-3 py-2">
            پادکست
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg bg-accent px-3 py-2 font-semibold text-ink"
          >
            بروزرسانی
          </button>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      {loading && !summary ? (
        <p className="mt-10 text-sm text-fog/60">بارگذاری KPIها...</p>
      ) : null}

      {summary ? (
        <>
          <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi
              label="هزینه AI (۲۴س)"
              value={`$${fmtNum(summary.costs.last24h, 4)}`}
              hint={`${fmtNum(summary.costs.requests)} درخواست`}
            />
            <Kpi
              label="توکن (۲۴س)"
              value={fmtNum(summary.costs.tokens)}
              hint={`in ${fmtNum(summary.costs.inputTokens)} · out ${fmtNum(summary.costs.outputTokens)}`}
            />
            <Kpi
              label="latency AI"
              value={fmtMs(summary.latency.aiAvgMs)}
              hint={`crawl ${fmtMs(summary.latency.crawlAvgMs)}`}
            />
            <Kpi
              label="پذیرش تحریریه (۷روز)"
              value={fmtPct(summary.editorial.acceptanceRatePct)}
              hint={`${fmtNum(summary.editorial.approve)} تأیید / ${fmtNum(summary.editorial.reject)} رد`}
            />
            <Kpi
              label="منابع فعال"
              value={fmtNum(summary.sources.active)}
              hint={`${fmtNum(summary.sources.errored)} مشکل‌دار`}
            />
            <Kpi
              label="مقالات امروز"
              value={fmtNum(summary.articles.discoveredToday)}
              hint={`pending ${fmtNum(summary.articles.pending)} · fail ${fmtNum(summary.articles.failed)}`}
            />
            <Kpi
              label="اپیزود منتشر"
              value={fmtNum(summary.episodes.published)}
              hint={`produced ${fmtNum(summary.episodes.produced)}`}
            />
            <Kpi
              label="crawlهای ۷روز"
              value={fmtNum(summary.sources.crawlRuns7d)}
              hint={`errors ${fmtNum(summary.sources.crawlErrors7d)}`}
            />
          </section>

          <p className="mt-4 text-[11px] text-fog/45">
            آخرین crawl: {fmtWhen(summary.pipeline.lastCrawlerRunAt)} · آخرین AI:{' '}
            {fmtWhen(summary.pipeline.lastNewsPipelineAt)}
          </p>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-fog/70">عمق صف‌ها</h2>
            <div className="mt-2 overflow-x-auto rounded-xl border border-fog/10">
              <table className="w-full min-w-[520px] text-left text-xs" dir="ltr">
                <thead className="bg-black/20 text-fog/50">
                  <tr>
                    <th className="px-3 py-2 text-right">queue</th>
                    <th className="px-3 py-2">waiting</th>
                    <th className="px-3 py-2">active</th>
                    <th className="px-3 py-2">failed</th>
                    <th className="px-3 py-2">delayed</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.queues.map((q) => (
                    <tr key={q.name} className="border-t border-fog/10">
                      <td className="px-3 py-2 text-right font-medium">{q.name}</td>
                      <td className="px-3 py-2">{q.waiting}</td>
                      <td className="px-3 py-2">{q.active}</td>
                      <td className="px-3 py-2 text-red-300/90">{q.failed}</td>
                      <td className="px-3 py-2">{q.delayed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-fog/70">عملکرد مدل (۷روز)</h2>
            <div className="mt-2 overflow-x-auto rounded-xl border border-fog/10">
              <table className="w-full min-w-[640px] text-left text-xs" dir="ltr">
                <thead className="bg-black/20 text-fog/50">
                  <tr>
                    <th className="px-3 py-2 text-right">stage / model</th>
                    <th className="px-3 py-2">req</th>
                    <th className="px-3 py-2">tokens</th>
                    <th className="px-3 py-2">cost</th>
                    <th className="px-3 py-2">latency</th>
                    <th className="px-3 py-2">err%</th>
                  </tr>
                </thead>
                <tbody>
                  {models.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-fog/45">
                        هنوز درخواست AI ثبت نشده
                      </td>
                    </tr>
                  ) : (
                    models.map((m) => (
                      <tr
                        key={`${m.pipelineStage}-${m.provider}-${m.model}`}
                        className="border-t border-fog/10"
                      >
                        <td className="px-3 py-2 text-right">
                          <div className="font-medium">{m.model}</div>
                          <div className="text-fog/45">
                            {m.provider} · {m.pipelineStage}
                          </div>
                        </td>
                        <td className="px-3 py-2">{fmtNum(m.requests)}</td>
                        <td className="px-3 py-2">{fmtNum(m.tokens)}</td>
                        <td className="px-3 py-2">${fmtNum(m.estimatedCost, 4)}</td>
                        <td className="px-3 py-2">{fmtMs(m.avgLatencyMs)}</td>
                        <td className="px-3 py-2">
                          {m.errorRate === null ? '—' : fmtPct(m.errorRate * 100)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-fog/70">هزینه هر اپیزود (۳۰روز)</h2>
            <div className="mt-2 overflow-x-auto rounded-xl border border-fog/10">
              <table className="w-full min-w-[520px] text-right text-xs">
                <thead className="bg-black/20 text-fog/50">
                  <tr>
                    <th className="px-3 py-2">اپیزود</th>
                    <th className="px-3 py-2">وضعیت</th>
                    <th className="px-3 py-2">درخواست</th>
                    <th className="px-3 py-2">توکن</th>
                    <th className="px-3 py-2">هزینه</th>
                  </tr>
                </thead>
                <tbody>
                  {episodeCosts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-fog/45">
                        هنوز هزینهٔ اپیزود ثبت نشده — یک اسکریپت/صوت جدید بسازید
                      </td>
                    </tr>
                  ) : (
                    episodeCosts.map((ep) => (
                      <tr key={ep.episodeId} className="border-t border-fog/10">
                        <td className="px-3 py-2">
                          <Link
                            href={`/podcasts/${ep.episodeId}`}
                            className="font-medium text-accent underline-offset-2 hover:underline"
                          >
                            {ep.title}
                          </Link>
                        </td>
                        <td className="px-3 py-2">{ep.status ?? '—'}</td>
                        <td className="px-3 py-2">{fmtNum(ep.requests)}</td>
                        <td className="px-3 py-2">{fmtNum(ep.tokens)}</td>
                        <td className="px-3 py-2">${fmtNum(ep.estimatedCost, 4)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-fog/70">عملکرد منابع (۷روز)</h2>
            <div className="mt-2 overflow-x-auto rounded-xl border border-fog/10">
              <table className="w-full min-w-[640px] text-right text-xs">
                <thead className="bg-black/20 text-fog/50">
                  <tr>
                    <th className="px-3 py-2">منبع</th>
                    <th className="px-3 py-2">سلامت</th>
                    <th className="px-3 py-2">runs</th>
                    <th className="px-3 py-2">کشف</th>
                    <th className="px-3 py-2">خطا</th>
                    <th className="px-3 py-2">نرخ موفقیت</th>
                    <th className="px-3 py-2">میانگین مدت</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s) => (
                    <tr key={s.id} className="border-t border-fog/10">
                      <td className="px-3 py-2 font-medium">
                        {s.name}
                        {!s.isActive ? (
                          <span className="mr-2 text-fog/40">(غیرفعال)</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">{s.healthStatus ?? '—'}</td>
                      <td className="px-3 py-2">{fmtNum(s.runs)}</td>
                      <td className="px-3 py-2">{fmtNum(s.discovered)}</td>
                      <td className="px-3 py-2">{fmtNum(s.errors)}</td>
                      <td className="px-3 py-2">
                        {s.successRate === null ? '—' : fmtPct(s.successRate * 100)}
                      </td>
                      <td className="px-3 py-2">{fmtMs(s.avgDurationMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-fog/10 bg-black/15 px-3 py-3">
      <div className="text-[11px] text-fog/50">{label}</div>
      <div className="mt-1 font-display text-lg font-bold text-accent">{value}</div>
      {hint ? <div className="mt-1 text-[10px] text-fog/40">{hint}</div> : null}
    </div>
  );
}
