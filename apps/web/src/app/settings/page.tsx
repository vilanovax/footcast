'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  apiFetch,
  clearTokens,
  getToken,
  hasPermission,
} from '../../lib/api';
import { SkeletonList } from '../../components/ui';
import { THEMES, type ThemeId, getStoredTheme, setTheme } from '../../lib/theme';
import {
  SETTINGS_NAV_GROUPS,
  THEME_PREVIEW,
  filterNavGroups,
} from '../../lib/settings-nav';

type Provider = {
  id: string;
  name: string;
  kind: string;
  baseUrl: string;
  enabled: boolean;
  timeoutMs: number;
  retryCount: number;
  rateLimitPerMinute: number;
  dailyBudgetUsd: number | null;
  monthlyBudgetUsd: number | null;
  defaultModel: string;
  apiKeyConfigured?: boolean;
  apiKeyLast4?: string | null;
  lastTestAt?: string | null;
  lastTestOk?: boolean | null;
  lastLatencyMs?: number | null;
};

type PipelineRow = {
  stage: string;
  label: string;
  primaryModel: string;
  fallbackModel: string;
  providerId: string;
  fallbackProviderId: string;
  temperature: number;
  maxTokens: number;
  effort: string;
  timeoutMs: number;
  retryCount: number;
  useCache: boolean;
  useBatch: boolean;
  enabled: boolean;
};

type AuditPolicy = {
  stage: string;
  label: string;
  enabled: boolean;
  mode: 'OFF' | 'SAMPLE' | 'ALL';
  sampleRate: number;
  auditorModel: string;
  auditorProviderId: string;
  blocking: boolean;
  triggerOnConflict: boolean;
  triggerOnRumor: boolean;
  triggerOnManualOverride: boolean;
  minimumScore: number | null;
  minimumCredibility: number | null;
};

type ControlCenter = {
  providers: Provider[];
  pipeline: PipelineRow[];
  auditPolicies: AuditPolicy[];
  editorialRules: Record<string, unknown>;
  editorialAutomation: Record<string, unknown>;
  scheduling: {
    timezone: string;
    lockHour: number;
    lockMinute: number;
    waves: Array<{
      id: string;
      timeLocal: string;
      kind: string;
      label: string;
      enabled: boolean;
    }>;
  };
  cost: Record<string, unknown>;
  quality: Record<string, unknown>;
  tts: {
    providerId: string;
    voice: string;
    speed: number;
    pronunciation: Array<{ from: string; to: string }>;
  };
  notifications: Record<string, unknown>;
  publishing: Record<string, unknown>;
  featureFlags: Record<string, boolean>;
  safeMode: {
    enabled: boolean;
    disableExpensiveModels: boolean;
    disableAiMerge: boolean;
    requireFullHumanPublish: boolean;
    reason: string;
  };
  prompts: { versionCount: number; note: string };
  auditLogs: Array<{
    id: string;
    action: string;
    entityId?: string | null;
    createdAt?: string;
  }>;
};

const FIELD =
  'w-full rounded-xl border border-fog/12 bg-black/25 px-3 py-2.5 text-sm text-fog outline-none focus:border-accent/45 disabled:opacity-55';

function ModeBadge({ mode }: { mode: string }) {
  const tone =
    mode === 'ALL'
      ? 'bg-accent/15 text-accent ring-accent/30'
      : mode === 'SAMPLE'
        ? 'bg-amber-400/15 text-amber-100 ring-amber-400/30'
        : 'bg-fog/10 text-fog/45 ring-fog/15';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${tone}`}>
      {mode}
    </span>
  );
}

function Panel({
  title,
  description,
  children,
  action,
  bare,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  /** No card chrome — just a section block */
  bare?: boolean;
}) {
  if (bare) {
    return (
      <section className="fn-fade-in space-y-3">
        {(title || action) && (
          <div className="flex items-end justify-between gap-3">
            <div>
              {title ? (
                <h2 className="text-[13px] font-semibold tracking-wide text-fog/90">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className="mt-0.5 text-[11px] text-fog/40">{description}</p>
              ) : null}
            </div>
            {action}
          </div>
        )}
        {children}
      </section>
    );
  }

  return (
    <section className="fn-fade-in rounded-2xl bg-[rgb(var(--surface)/var(--surface-a))] px-4 py-4 sm:px-5">
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-[13px] font-semibold text-fog/90">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-[11px] leading-5 text-fog/40">{description}</p>
            ) : null}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  hint,
  onClick,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  onClick?: () => void;
  tone?: 'default' | 'accent' | 'warn' | 'ok';
}) {
  const accent =
    tone === 'accent'
      ? 'text-accent'
      : tone === 'warn'
        ? 'text-amber-200'
        : tone === 'ok'
          ? 'text-emerald-200'
          : 'text-fog';
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-xl px-3 py-3 text-right transition ${
        onClick
          ? 'hover:bg-[rgb(var(--fog)/0.06)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent/40'
          : ''
      }`}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-fog/35">
        {label}
      </p>
      <p className={`mt-1.5 font-display text-2xl font-bold tabular-nums leading-none ${accent}`}>
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-[10px] text-fog/35">{hint}</p> : null}
    </Comp>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const search = useSearchParams();
  /** Permissions read only after mount — avoids SSR/client hydration mismatch. */
  const [permsReady, setPermsReady] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  const [canRead, setCanRead] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [data, setData] = useState<ControlCenter | null>(null);
  const [theme, setThemeState] = useState<ThemeId>('pitch');
  const [keyDraft, setKeyDraft] = useState<Record<string, string>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [navQuery, setNavQuery] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const section = search.get('section') ?? 'general';

  useEffect(() => {
    const write = hasPermission('settings:write');
    setCanWrite(write);
    setCanRead(hasPermission('settings:read') || write);
    setPermsReady(true);
  }, []);

  const navGroups = useMemo(() => {
    const base = filterNavGroups(SETTINGS_NAV_GROUPS, canWrite);
    if (!navQuery.trim()) return base;
    const q = navQuery.trim();
    return base
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => i.label.includes(q) || i.id.includes(q)),
      }))
      .filter((g) => g.items.length > 0);
  }, [canWrite, navQuery]);

  const currentLabel = useMemo(() => {
    for (const g of SETTINGS_NAV_GROUPS) {
      const hit = g.items.find((i) => i.id === section);
      if (hit) return hit.label;
    }
    return 'تنظیمات';
  }, [section]);

  const load = useCallback(async () => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<ControlCenter>('/settings/control');
      setData(res.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'خطا';
      setError(message);
      if (/unauthorized|jwt|token/i.test(message) && !/forbidden|permission/i.test(message)) {
        clearTokens();
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    setThemeState(getStoredTheme());
    void load();
  }, [load]);

  function go(id: string) {
    router.replace(`/settings?section=${id}`);
    setMobileNavOpen(false);
  }

  function toast(msg: string) {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 2400);
  }

  async function patchSection(sectionId: string, payload: unknown) {
    if (!canWrite) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch<ControlCenter>(`/settings/control/${sectionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ data: payload }),
      });
      setData(res.data);
      toast('ذخیره شد');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ذخیره ناموفق');
    } finally {
      setSaving(false);
    }
  }

  async function saveProviderKey(id: string, clear = false) {
    if (!canWrite) return;
    setSaving(true);
    try {
      const res = await apiFetch<Provider[]>(`/settings/control/providers/${id}/key`, {
        method: 'POST',
        body: JSON.stringify({
          apiKey: clear ? undefined : keyDraft[id],
          clear,
        }),
      });
      setData((prev) => (prev ? { ...prev, providers: res.data } : prev));
      setKeyDraft((d) => ({ ...d, [id]: '' }));
      toast(clear ? 'کلید پاک شد' : 'کلید رمزنگاری و ذخیره شد');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در کلید');
    } finally {
      setSaving(false);
    }
  }

  async function testProvider(id: string) {
    if (!canWrite) return;
    setTestingId(id);
    try {
      const res = await apiFetch<{
        ok: boolean;
        message: string;
        latencyMs: number;
        provider: Provider | null;
      }>(`/settings/control/providers/${id}/test`, { method: 'POST', body: '{}' });
      if (res.data.provider) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                providers: prev.providers.map((p) =>
                  p.id === id ? res.data.provider! : p,
                ),
              }
            : prev,
        );
      }
      toast(
        res.data.ok
          ? `تست موفق · ${res.data.latencyMs}ms`
          : `ناموفق: ${res.data.message}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تست ناموفق');
    } finally {
      setTestingId(null);
    }
  }

  const activeProviders = data?.providers.filter((p) => p.enabled).length ?? 0;
  const keyedProviders =
    data?.providers.filter((p) => p.apiKeyConfigured).length ?? 0;
  const blockingAudits =
    data?.auditPolicies.filter((p) => p.blocking && p.mode !== 'OFF').length ?? 0;

  if (!permsReady || (loading && !data)) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-4 pb-28 pt-5" dir="rtl">
        <h1 className="font-display text-2xl font-bold">مرکز کنترل</h1>
        <p className="mt-1 text-[11px] text-fog/45">در حال بارگذاری…</p>
        <div className="mt-4">
          <SkeletonList rows={4} />
        </div>
      </main>
    );
  }

  if (!canRead) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10" dir="rtl">
        <p className="text-sm text-fog/60">دسترسی به تنظیمات ندارید.</p>
        <Link href="/work" className="mt-4 inline-block text-accent underline">
          بازگشت
        </Link>
      </main>
    );
  }

  const nav = (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-3 pt-4">
        <p className="text-[11px] font-semibold text-fog/90">تنظیمات</p>
        <div className="relative mt-3">
          <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-fog/30" aria-hidden>
            ⌕
          </span>
          <input
            value={navQuery}
            onChange={(e) => setNavQuery(e.target.value)}
            placeholder="جستجو…"
            className="w-full rounded-lg bg-[rgb(var(--fog)/0.06)] py-2 pe-3 ps-8 text-[12px] text-fog outline-none ring-1 ring-fog/10 placeholder:text-fog/30 focus:ring-accent/35"
            aria-label="جستجوی بخش"
          />
        </div>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-4" aria-label="بخش‌های تنظیمات">
        {navGroups.map((group) => (
          <div key={group.id}>
            <p className="mb-1 px-2.5 text-[10px] font-medium uppercase tracking-wider text-fog/30">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = section === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => go(item.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] transition ${
                        active
                          ? 'bg-[rgb(var(--accent)/0.14)] font-semibold text-accent'
                          : 'text-fog/55 hover:bg-[rgb(var(--fog)/0.06)] hover:text-fog/85'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          active ? 'bg-accent' : 'bg-transparent'
                        }`}
                        aria-hidden
                      />
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-3 pb-28 pt-3 sm:px-5" dir="rtl">
      <header className="mb-5 flex items-center justify-between gap-3 border-b border-fog/8 pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] text-fog/40">
            <Link href="/settings" className="hover:text-accent">
              تنظیمات
            </Link>
            <span aria-hidden>/</span>
            <span className="text-fog/70">{currentLabel}</span>
          </div>
          <h1 className="mt-1 font-display text-xl font-bold tracking-tight sm:text-2xl">
            {currentLabel}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] text-fog/60 hover:bg-fog/10 hover:text-fog lg:hidden"
            onClick={() => setMobileNavOpen(true)}
          >
            فهرست
          </button>
          <Link
            href="/work"
            className="inline-flex h-9 items-center rounded-full px-3 text-[12px] text-fog/55 hover:bg-fog/10 hover:text-fog"
          >
            میز کار
          </Link>
        </div>
      </header>

      {flash ? (
        <div
          role="status"
          className="fn-slide-up fixed bottom-24 left-1/2 z-50 w-[min(20rem,calc(100%-2rem))] -translate-x-1/2 rounded-full bg-accent px-5 py-2.5 text-center text-[12px] font-semibold text-ink shadow-lg"
        >
          {flash}
        </div>
      ) : null}

      {error ? (
        <p className="mb-4 rounded-xl bg-red-500/10 px-3 py-2 text-[11px] text-red-100">
          {error}
          <button type="button" className="ms-2 underline" onClick={() => void load()}>
            تلاش دوباره
          </button>
        </p>
      ) : null}

      {data?.safeMode.enabled ? (
        <p className="mb-4 rounded-xl bg-amber-400/10 px-3 py-2 text-[11px] text-amber-50">
          Safe Mode فعال است.
          <button
            type="button"
            className="ms-2 font-semibold text-accent underline"
            onClick={() => go('safe-mode')}
          >
            مدیریت
          </button>
        </p>
      ) : null}

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            aria-label="بستن"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 w-[min(19rem,90vw)] bg-[rgb(var(--chrome))] shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-semibold">فهرست</span>
              <button
                type="button"
                className="text-[12px] text-fog/45"
                onClick={() => setMobileNavOpen(false)}
              >
                بستن
              </button>
            </div>
            {nav}
          </div>
        </div>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
        <aside className="sticky top-16 hidden max-h-[calc(100vh-5.5rem)] overflow-hidden lg:block">
          {nav}
        </aside>

        <div className="min-w-0 space-y-8">
          {/* ——— GENERAL / OVERVIEW ——— */}
          {section === 'general' ? (
            <div className="space-y-8">
              <Panel bare title="وضعیت">
                <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[rgb(var(--surface)/var(--surface-a))] p-1 sm:grid-cols-4">
                  <StatCard
                    label="Provider"
                    value={activeProviders.toLocaleString('fa-IR')}
                    hint={`${keyedProviders.toLocaleString('fa-IR')} کلید`}
                    tone="ok"
                    onClick={() => go('providers')}
                  />
                  <StatCard
                    label="ممیزی blocking"
                    value={blockingAudits.toLocaleString('fa-IR')}
                    tone={blockingAudits > 0 ? 'warn' : 'default'}
                    onClick={() => go('audit')}
                  />
                  <StatCard
                    label="Prompt"
                    value={(data?.prompts.versionCount ?? 0).toLocaleString('fa-IR')}
                    onClick={() => go('prompts')}
                  />
                  <StatCard
                    label="قفل"
                    value={
                      data
                        ? `${String(data.scheduling.lockHour).padStart(2, '0')}:${String(data.scheduling.lockMinute).padStart(2, '0')}`
                        : '۱۶:۰۰'
                    }
                    hint="تهران"
                    tone="accent"
                    onClick={() => go('scheduling')}
                  />
                </div>
              </Panel>

              <Panel bare title="ظاهر">
                <div
                  className="inline-flex w-full max-w-md rounded-full bg-[rgb(var(--surface)/var(--surface-a))] p-1"
                  role="radiogroup"
                  aria-label="تم"
                >
                  {THEMES.map((t) => {
                    const active = theme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => {
                          setTheme(t.id);
                          setThemeState(t.id);
                          if (canWrite) {
                            void apiFetch('/settings/ui', {
                              method: 'PATCH',
                              body: JSON.stringify({ theme: t.id }),
                            }).then(() => toast('تم ذخیره شد'));
                          } else {
                            toast('تم روی این دستگاه ذخیره شد');
                          }
                        }}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-[12px] font-medium transition ${
                          active
                            ? 'bg-accent text-ink shadow-sm'
                            : 'text-fog/50 hover:text-fog/80'
                        }`}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full ring-1 ring-black/20"
                          style={{
                            background: THEME_PREVIEW[t.id]?.accent,
                            boxShadow: `inset 0 0 0 1px ${THEME_PREVIEW[t.id]?.bg}`,
                          }}
                          aria-hidden
                        />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </Panel>

              <Panel bare title="میان‌بر">
                <ul className="divide-y divide-fog/8 rounded-2xl bg-[rgb(var(--surface)/var(--surface-a))]">
                  {(
                    [
                      { id: 'providers', title: 'Provider و کلید', body: 'اتصال و سقف هزینه' },
                      { id: 'pipeline', title: 'Pipeline', body: 'مدل هر مرحله' },
                      { id: 'audit', title: 'ممیزی AI', body: 'OFF / SAMPLE / ALL' },
                      { id: 'editorial', title: 'قواعد سردبیری', body: 'آستانه و سهم پوشش' },
                      { id: 'cost', title: 'بودجه', body: 'سقف روزانه و ماهانه' },
                      { id: 'safe-mode', title: 'Safe Mode', body: 'کاهش ریسک عملیاتی' },
                    ] as const
                  ).map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => go(row.id)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-right transition hover:bg-[rgb(var(--fog)/0.04)]"
                      >
                        <span>
                          <span className="block text-[13px] font-medium text-fog/90">
                            {row.title}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-fog/35">
                            {row.body}
                          </span>
                        </span>
                        <span className="text-fog/25" aria-hidden>
                          ‹
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-4 px-1 text-[12px]">
                  <Link href="/sources" className="text-fog/45 hover:text-accent">
                    منابع
                  </Link>
                  <Link href="/dashboard" className="text-fog/45 hover:text-accent">
                    گزارش
                  </Link>
                  <Link href="/rundown" className="text-fog/45 hover:text-accent">
                    Today
                  </Link>
                </div>
              </Panel>
            </div>
          ) : null}

          {/* ——— PROVIDERS ——— */}
          {section === 'providers' && data ? (
            <div className="space-y-3">
              <Panel
                title="AI Providers"
                description="کلیدها رمزنگاری می‌شوند · فقط last4 در UI · تغییر Audit می‌شود"
              >
                {!canWrite ? (
                  <p className="mb-3 text-[11px] text-amber-100/90">فقط مشاهده — Admin لازم است.</p>
                ) : null}
                <ul className="space-y-2">
                  {data.providers.map((p) => (
                    <li
                      key={p.id}
                      className="rounded-xl bg-[rgb(var(--fog)/0.04)] px-3.5 py-3.5 ring-1 ring-fog/8"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="text-[13px] font-bold">{p.name}</h3>
                          <p className="mt-0.5 text-[10px] text-fog/40" dir="ltr">
                            {p.baseUrl || '—'}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] ring-1 ${
                              p.enabled
                                ? 'bg-emerald-400/15 text-emerald-100 ring-emerald-400/30'
                                : 'bg-fog/10 text-fog/45 ring-fog/15'
                            }`}
                          >
                            {p.enabled ? 'Active' : 'Off'}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] ring-1 ${
                              p.apiKeyConfigured
                                ? 'bg-accent/15 text-accent ring-accent/30'
                                : 'bg-fog/10 text-fog/40 ring-fog/15'
                            }`}
                          >
                            {p.apiKeyConfigured
                              ? `••••${p.apiKeyLast4}`
                              : 'بدون کلید'}
                          </span>
                        </div>
                      </div>
                      <dl className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-fog/55 sm:grid-cols-4">
                        <div>
                          <dt className="text-fog/35">Timeout</dt>
                          <dd>{p.timeoutMs}ms</dd>
                        </div>
                        <div>
                          <dt className="text-fog/35">Retry</dt>
                          <dd>{p.retryCount}</dd>
                        </div>
                        <div>
                          <dt className="text-fog/35">سقف روز</dt>
                          <dd>{p.dailyBudgetUsd ?? '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-fog/35">مدل</dt>
                          <dd className="truncate" dir="ltr">
                            {p.defaultModel || '—'}
                          </dd>
                        </div>
                      </dl>
                      {p.lastTestAt ? (
                        <p className="mt-2 text-[10px] text-fog/45">
                          Last test:{' '}
                          {p.lastTestOk ? (
                            <span className="text-emerald-200">Successful</span>
                          ) : (
                            <span className="text-red-200">Failed</span>
                          )}
                          {p.lastLatencyMs != null
                            ? ` · Latency ${p.lastLatencyMs}ms`
                            : ''}
                        </p>
                      ) : null}
                      {canWrite ? (
                        <div className="mt-3 space-y-2 border-t border-fog/8 pt-3">
                          <div className="flex gap-2">
                            <input
                              type="password"
                              className={FIELD}
                              placeholder="API Key جدید…"
                              value={keyDraft[p.id] ?? ''}
                              onChange={(e) =>
                                setKeyDraft((d) => ({ ...d, [p.id]: e.target.value }))
                              }
                              dir="ltr"
                              autoComplete="off"
                            />
                            <button
                              type="button"
                              disabled={saving || !(keyDraft[p.id] ?? '').trim()}
                              onClick={() => void saveProviderKey(p.id)}
                              className="shrink-0 rounded-xl bg-accent px-3 text-[11px] font-semibold text-ink disabled:opacity-50"
                            >
                              ذخیره
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={testingId === p.id}
                              onClick={() => void testProvider(p.id)}
                              className="rounded-lg border border-fog/20 px-3 py-1.5 text-[11px]"
                            >
                              {testingId === p.id ? '…' : 'تست اتصال'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const next = data.providers.map((x) =>
                                  x.id === p.id
                                    ? { ...x, enabled: !x.enabled }
                                    : x,
                                );
                                void patchSection('providers', next);
                              }}
                              className="rounded-lg border border-fog/20 px-3 py-1.5 text-[11px]"
                            >
                              {p.enabled ? 'غیرفعال' : 'فعال‌سازی'}
                            </button>
                            {p.apiKeyConfigured ? (
                              <button
                                type="button"
                                onClick={() => void saveProviderKey(p.id, true)}
                                className="rounded-lg px-3 py-1.5 text-[11px] text-red-200/90"
                              >
                                پاک کردن کلید
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          ) : null}

          {section === 'pipeline' && data ? (
            <Panel
              title="تخصیص Pipeline"
              description="مدل اصلی + جایگزین — ممیز جدا از تولیدکننده"
              action={
                canWrite ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void patchSection('pipeline', data.pipeline)}
                    className="rounded-xl bg-accent px-3 py-1.5 text-[11px] font-semibold text-ink"
                  >
                    ذخیره
                  </button>
                ) : null
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-right text-[11px]">
                  <thead className="text-fog/40">
                    <tr className="border-b border-fog/10">
                      <th className="py-2 font-medium">مرحله</th>
                      <th className="py-2 font-medium">مدل اصلی</th>
                      <th className="py-2 font-medium">جایگزین</th>
                      <th className="py-2 font-medium">temp</th>
                      <th className="py-2 font-medium">cache</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pipeline.map((row, i) => (
                      <tr key={row.stage} className="border-b border-fog/8">
                        <td className="py-2.5 font-semibold">{row.label}</td>
                        <td className="py-2.5" dir="ltr">
                          <input
                            className="w-40 rounded-lg border border-fog/12 bg-black/25 px-2 py-1"
                            value={row.primaryModel}
                            disabled={!canWrite}
                            onChange={(e) => {
                              const next = [...data.pipeline];
                              next[i] = { ...row, primaryModel: e.target.value };
                              setData({ ...data, pipeline: next });
                            }}
                          />
                        </td>
                        <td className="py-2.5" dir="ltr">
                          <input
                            className="w-40 rounded-lg border border-fog/12 bg-black/25 px-2 py-1"
                            value={row.fallbackModel}
                            disabled={!canWrite}
                            onChange={(e) => {
                              const next = [...data.pipeline];
                              next[i] = { ...row, fallbackModel: e.target.value };
                              setData({ ...data, pipeline: next });
                            }}
                          />
                        </td>
                        <td className="py-2.5 tabular-nums">{row.temperature}</td>
                        <td className="py-2.5">{row.useCache ? '✓' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}

          {section === 'audit' && data ? (
            <div className="space-y-3">
              <Panel
                title="ممیزی هوش مصنوعی"
                description="OFF / SAMPLE / ALL · مدل ممیز مستقل · blocking برای انتشار"
                action={
                  canWrite ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void patchSection('audit', data.auditPolicies)}
                      className="rounded-xl bg-accent px-3 py-1.5 text-[11px] font-semibold text-ink"
                    >
                      ذخیره
                    </button>
                  ) : null
                }
              >
                <div className="space-y-3">
                  {data.auditPolicies.map((pol, i) => (
                    <article
                      key={pol.stage}
                      className="rounded-2xl border border-fog/10 bg-black/20 p-3.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-[13px] font-bold">{pol.label}</h3>
                        <ModeBadge mode={pol.mode} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(['OFF', 'SAMPLE', 'ALL'] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            disabled={!canWrite}
                            onClick={() => {
                              const next = [...data.auditPolicies];
                              next[i] = { ...pol, mode: m, enabled: m !== 'OFF' };
                              setData({ ...data, auditPolicies: next });
                            }}
                            className={`rounded-lg px-2.5 py-1 text-[10px] font-medium ${
                              pol.mode === m
                                ? 'bg-accent text-ink'
                                : 'border border-fog/15 text-fog/55'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                      <p className="mt-2 text-[10px] text-fog/45">
                        نمونه {Math.round(pol.sampleRate * 100)}٪ · ممیز{' '}
                        <span dir="ltr">{pol.auditorModel}</span>
                        {pol.blocking ? ' · مسدودکننده انتشار' : ''}
                      </p>
                      <label className="mt-2 flex items-center gap-2 text-[11px] text-fog/70">
                        <input
                          type="checkbox"
                          checked={pol.blocking}
                          disabled={!canWrite}
                          onChange={(e) => {
                            const next = [...data.auditPolicies];
                            next[i] = { ...pol, blocking: e.target.checked };
                            setData({ ...data, auditPolicies: next });
                          }}
                        />
                        تا ممیزی موفق نشود ادامه/انتشار ممکن نباشد
                      </label>
                    </article>
                  ))}
                </div>
              </Panel>
            </div>
          ) : null}

          {section === 'editorial' && data ? (
            <JsonPanel
              title="قواعد سردبیری"
              description="حداقل امتیاز، سهم ایران/اروپا، شایعه و conflict"
              value={data.editorialRules}
              canWrite={canWrite}
              saving={saving}
              onSave={(v) => void patchSection('editorial', v)}
            />
          ) : null}

          {section === 'automation' && data ? (
            <JsonPanel
              title="اتوماسیون انتخاب خبر"
              description="پروفایل ASSISTED پیش‌فرض: Highlight + Suggest روشن؛ Auto Add خاموش. جزئیات: docs/AUTO_EDITORIAL_SELECTION.md"
              value={data.editorialAutomation ?? {}}
              canWrite={canWrite}
              saving={saving}
              onSave={(v) => void patchSection('automation', v)}
            />
          ) : null}

          {section === 'scheduling' && data ? (
            <Panel title="زمان‌بندی موج‌ها" description={`${data.scheduling.timezone}`}>
              <p className="mb-3 text-[12px] text-fog/60">
                قفل Today:{' '}
                <strong className="text-accent">
                  {String(data.scheduling.lockHour).padStart(2, '0')}:
                  {String(data.scheduling.lockMinute).padStart(2, '0')}
                </strong>
              </p>
              <ol className="relative space-y-0 border-s border-accent/25 ms-2 ps-4">
                {data.scheduling.waves.map((w) => (
                  <li key={w.id} className="relative pb-3">
                    <span className="absolute -right-[1.3rem] top-1.5 h-2.5 w-2.5 rounded-full bg-accent" />
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-fog/10 bg-black/20 px-3 py-2">
                      <span className="font-display text-sm font-bold tabular-nums text-accent">
                        {w.timeLocal}
                      </span>
                      <span className="text-[12px] text-fog/85">{w.label}</span>
                      <span className="rounded-full bg-fog/10 px-2 py-0.5 text-[9px] text-fog/40">
                        {w.kind}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
              {canWrite ? (
                <button
                  type="button"
                  className="mt-2 rounded-xl border border-accent/40 px-4 py-2 text-[11px] text-accent"
                  onClick={() => void patchSection('scheduling', data.scheduling)}
                >
                  ذخیره زمان‌بندی
                </button>
              ) : null}
            </Panel>
          ) : null}

          {section === 'cost' && data ? (
            <JsonPanel
              title="هزینه و بودجه"
              description="سقف روزانه/ماهانه · هشدار ۷۰٪ · قطع مدل گران"
              value={data.cost}
              canWrite={canWrite}
              saving={saving}
              onSave={(v) => void patchSection('cost', v)}
            />
          ) : null}

          {section === 'quality' && data ? (
            <JsonPanel
              title="آستانه‌های کیفیت"
              description="اعتماد extraction/cluster و حداقل ممیزی"
              value={data.quality}
              canWrite={canWrite}
              saving={saving}
              onSave={(v) => void patchSection('quality', v)}
            />
          ) : null}

          {section === 'tts' && data ? (
            <Panel title="TTS و تلفظ" description={`Voice: ${data.tts.voice}`}>
              <ul className="space-y-1.5">
                {data.tts.pronunciation.map((row) => (
                  <li
                    key={row.from}
                    className="flex justify-between rounded-xl bg-black/20 px-3 py-2 text-[12px]"
                  >
                    <span dir="ltr">{row.from}</span>
                    <span>{row.to}</span>
                  </li>
                ))}
              </ul>
              {canWrite ? (
                <button
                  type="button"
                  className="mt-3 rounded-xl bg-accent px-4 py-2 text-[11px] font-semibold text-ink"
                  onClick={() => void patchSection('tts', data.tts)}
                >
                  ذخیره TTS
                </button>
              ) : null}
            </Panel>
          ) : null}

          {section === 'flags' && data ? (
            <Panel
              title="Feature Flags"
              action={
                canWrite ? (
                  <button
                    type="button"
                    className="rounded-xl bg-accent px-3 py-1.5 text-[11px] font-semibold text-ink"
                    onClick={() => void patchSection('flags', data.featureFlags)}
                  >
                    ذخیره
                  </button>
                ) : null
              }
            >
              <ul className="space-y-2">
                {Object.entries(data.featureFlags).map(([key, val]) => (
                  <li key={key}>
                    <label className="flex items-center justify-between gap-3 rounded-xl border border-fog/10 bg-black/20 px-3 py-2.5 text-[12px]">
                      <span className="font-mono text-[11px]" dir="ltr">
                        {key}
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(val)}
                        disabled={!canWrite}
                        onChange={(e) =>
                          setData({
                            ...data,
                            featureFlags: {
                              ...data.featureFlags,
                              [key]: e.target.checked,
                            },
                          })
                        }
                      />
                    </label>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {section === 'safe-mode' && data ? (
            <Panel title="Safe Mode" description="کاهش ریسک هزینه و خطای Provider">
              <label className="flex items-center gap-2 text-[12px]">
                <input
                  type="checkbox"
                  checked={data.safeMode.enabled}
                  disabled={!canWrite}
                  onChange={(e) =>
                    setData({
                      ...data,
                      safeMode: { ...data.safeMode, enabled: e.target.checked },
                    })
                  }
                />
                فعال‌سازی Safe Mode
              </label>
              <textarea
                className={`${FIELD} mt-3 min-h-24`}
                placeholder="دلیل…"
                value={data.safeMode.reason}
                disabled={!canWrite}
                onChange={(e) =>
                  setData({
                    ...data,
                    safeMode: { ...data.safeMode, reason: e.target.value },
                  })
                }
              />
              {canWrite ? (
                <button
                  type="button"
                  className="mt-3 rounded-xl bg-accent px-4 py-2 text-[11px] font-semibold text-ink"
                  onClick={() => void patchSection('safe-mode', data.safeMode)}
                >
                  ذخیره
                </button>
              ) : null}
            </Panel>
          ) : null}

          {section === 'prompts' ? (
            <Panel title="Promptها" description="نسخه‌بندی قالب‌های استخراج، داور، سردبیری">
              <p className="text-[13px] text-fog/80">
                {(data?.prompts.versionCount ?? 0).toLocaleString('fa-IR')} نسخه در
                دیتابیس
              </p>
              <p className="mt-2 text-[11px] text-fog/45">
                {data?.prompts.note ??
                  'ویرایشگر کامل Prompt در فاز بعد؛ فعلاً از seed و API usage استفاده کنید.'}
              </p>
              <Link
                href="/dashboard"
                className="mt-3 inline-block text-[12px] text-accent underline"
              >
                گزارش usage
              </Link>
            </Panel>
          ) : null}

          {section === 'coverage' || section === 'weights' ? (
            <Panel
              title={section === 'coverage' ? 'اهداف پوشش' : 'وزن تیم / لیگ'}
              description="داده‌های زنده از Coverage Intelligence"
            >
              <p className="text-[12px] leading-6 text-fog/60">
                اهداف و وزن‌ها در جداول editorial و coverage_targets نگه داشته می‌شوند.
                برای کار روزمره از پنل پوشش در Today استفاده کنید.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/rundown"
                  className="rounded-xl bg-accent px-4 py-2 text-[11px] font-semibold text-ink"
                >
                  باز کردن Today
                </Link>
                <Link
                  href="/inbox"
                  className="rounded-xl border border-fog/15 px-4 py-2 text-[11px] text-fog/70"
                >
                  inbox
                </Link>
              </div>
            </Panel>
          ) : null}

          {section === 'notifications' && data ? (
            <JsonPanel
              title="اعلان‌ها"
              description="خطای crawler/AI، هزینه، قفل ۱۶، ممیزی"
              value={data.notifications}
              canWrite={canWrite}
              saving={saving}
              onSave={(v) => void patchSection('notifications', v)}
            />
          ) : null}

          {section === 'publishing' && data ? (
            <JsonPanel
              title="انتشار"
              description="کانال‌ها و انتشار خودکار/دستی"
              value={data.publishing}
              canWrite={canWrite}
              saving={saving}
              onSave={(v) => void patchSection('publishing', v)}
            />
          ) : null}

          {section === 'audit-logs' && data ? (
            <Panel title="Audit Logs" description="تغییر کلید، Override، سیاست‌ها">
              <ul className="max-h-[28rem] space-y-1.5 overflow-y-auto">
                {data.auditLogs.length === 0 ? (
                  <li className="rounded-xl border border-dashed border-fog/15 px-4 py-8 text-center text-[12px] text-fog/40">
                    هنوز لاگی ثبت نشده — با ذخیره کلید یا سیاست اینجا پر می‌شود.
                  </li>
                ) : (
                  data.auditLogs.map((log) => (
                    <li
                      key={log.id}
                      className="rounded-xl border border-fog/8 bg-black/20 px-3 py-2 text-[11px]"
                    >
                      <span className="font-semibold text-fog/90">{log.action}</span>
                      <span className="mt-0.5 block truncate text-fog/40" dir="ltr">
                        {log.entityId}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </Panel>
          ) : null}

          {section === 'test-center' ? (
            <Panel
              title="Test Center"
              description="تست Provider الان؛ Prompt / extraction / TTS به‌زودی"
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => go('providers')}
                  className="rounded-2xl border border-accent/35 bg-accent/10 px-4 py-4 text-right"
                >
                  <span className="block text-[13px] font-bold text-accent">
                    تست Provider
                  </span>
                  <span className="mt-1 block text-[11px] text-fog/50">
                    اتصال، latency، وضعیت کلید
                  </span>
                </button>
                <div className="rounded-2xl border border-dashed border-fog/15 px-4 py-4 text-right">
                  <span className="block text-[13px] font-bold text-fog/50">
                    تست Prompt
                  </span>
                  <span className="mt-1 block text-[11px] text-fog/35">فاز بعد</span>
                </div>
              </div>
            </Panel>
          ) : null}

          {/* Fallback if section unknown or data missing for data sections */}
          {!loading &&
          section !== 'general' &&
          section !== 'prompts' &&
          section !== 'coverage' &&
          section !== 'weights' &&
          section !== 'test-center' &&
          !data ? (
            <Panel title={currentLabel} description="در حال بارگذاری داده از API نیست">
              <p className="text-[12px] text-fog/55">
                اتصال به مرکز کنترل برقرار نشد.
              </p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-3 rounded-xl bg-accent px-4 py-2 text-[11px] font-semibold text-ink"
              >
                تلاش دوباره
              </button>
            </Panel>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function JsonPanel({
  title,
  description,
  value,
  canWrite,
  saving,
  onSave,
}: {
  title: string;
  description: string;
  value: Record<string, unknown>;
  canWrite: boolean;
  saving: boolean;
  onSave: (v: Record<string, unknown>) => void;
}) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    setText(JSON.stringify(value, null, 2));
  }, [value]);

  const entries = Object.entries(value);

  return (
    <Panel
      title={title}
      description={description}
      action={
        canWrite ? (
          <button
            type="button"
            disabled={saving}
            className="rounded-xl bg-accent px-3 py-1.5 text-[11px] font-semibold text-ink disabled:opacity-50"
            onClick={() => {
              if (advanced) {
                try {
                  onSave(JSON.parse(text) as Record<string, unknown>);
                  setLocalErr(null);
                } catch {
                  setLocalErr('JSON نامعتبر');
                }
              } else {
                onSave(value);
              }
            }}
          >
            ذخیره
          </button>
        ) : null
      }
    >
      {!advanced ? (
        <ul className="space-y-2">
          {entries.map(([k, v]) => (
            <li
              key={k}
              className="flex items-center justify-between gap-3 rounded-xl border border-fog/8 bg-black/20 px-3 py-2.5"
            >
              <span className="text-[11px] text-fog/50" dir="ltr">
                {k}
              </span>
              <span className="max-w-[55%] truncate text-[12px] font-medium text-fog/90" dir="ltr">
                {typeof v === 'object' ? JSON.stringify(v) : String(v)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <textarea
          className={`${FIELD} min-h-[240px] font-mono text-[11px]`}
          dir="ltr"
          value={text}
          disabled={!canWrite}
          onChange={(e) => setText(e.target.value)}
        />
      )}
      {localErr ? <p className="mt-2 text-[11px] text-red-200">{localErr}</p> : null}
      <button
        type="button"
        className="mt-3 text-[11px] text-fog/45 underline"
        onClick={() => setAdvanced((v) => !v)}
      >
        {advanced ? 'نمای ساده' : 'ویرایش JSON پیشرفته'}
      </button>
    </Panel>
  );
}
