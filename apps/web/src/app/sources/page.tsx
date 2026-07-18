'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, clearTokens, getToken } from '../../lib/api';
import { credibilityTierLabel, labelHealth } from '../../lib/labels';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyState, PageHeader, SkeletonList } from '../../components/ui';

type Source = {
  id: string;
  name: string;
  slug: string;
  sourceType: string;
  language?: string;
  baseUrl: string;
  rssUrl?: string | null;
  sitemapUrl?: string | null;
  isActive: boolean;
  coverageScope?: string;
  credibilitySeed?: number;
  priority?: number;
  fetchIntervalSec?: number;
  health?: { status?: string | null; lastErrorMessage?: string | null } | null;
};

const PRESETS = [
  {
    name: 'ورزش۳',
    slug: 'varzesh3',
    baseUrl: 'https://www.varzesh3.com',
    rssUrl: 'https://www.varzesh3.com/rss/all',
    sourceType: 'LOCAL_SPORTS_MEDIA',
    coverageScope: 'IRAN',
    note: 'RSS عمومی ورزش۳ (فوتبال + سایر ورزش‌ها؛ فیلتر فوتبال بعداً اعمال می‌شود)',
  },
  {
    name: 'ایرنا ورزش',
    slug: 'irna-sports',
    baseUrl: 'https://www.irna.ir',
    rssUrl: 'https://www.irna.ir/rss/tp/14',
    sourceType: 'NEWS_AGENCY',
    coverageScope: 'IRAN',
    note: 'بخش ورزشی ایرنا',
  },
  {
    name: 'خبرگزاری مهر — ورزش',
    slug: 'mehr-sport',
    baseUrl: 'https://www.mehrnews.com',
    rssUrl: 'https://www.mehrnews.com/rss/tp/9',
    sourceType: 'NEWS_AGENCY',
    coverageScope: 'IRAN',
    note: 'RSS ورزشی مهر',
  },
  {
    name: 'باشگاه خبرنگاران — ورزش',
    slug: 'yjc-sport',
    baseUrl: 'https://www.yjc.ir',
    rssUrl: 'https://www.yjc.ir/fa/rss/8',
    sourceType: 'NEWS_AGENCY',
    coverageScope: 'IRAN',
    note: 'RSS ورزشی یو‌جی‌سی',
  },
];

function toSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/gi, '-')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || `source-${Date.now().toString(36)}`;
}

export default function SourcesPage() {
  const router = useRouter();
  const [items, setItems] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://');
  const [rssUrl, setRssUrl] = useState('');
  const [sourceType, setSourceType] = useState('LOCAL_SPORTS_MEDIA');
  const [coverageScope, setCoverageScope] = useState('IRAN');
  const [credibilitySeed, setCredibilitySeed] = useState('70');
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<Source[]>('/sources?pageSize=50');
      setItems(res.data ?? []);
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

  function applyPreset(preset: (typeof PRESETS)[number]) {
    setEditingId(null);
    setName(preset.name);
    setSlug(preset.slug);
    setBaseUrl(preset.baseUrl);
    setRssUrl(preset.rssUrl);
    setSourceType(preset.sourceType);
    setCoverageScope(preset.coverageScope);
    setCredibilitySeed(preset.sourceType === 'NEWS_AGENCY' ? '85' : '70');
    setShowForm(true);
    setFlash(preset.note);
  }

  function startEdit(source: Source) {
    setEditingId(source.id);
    setName(source.name);
    setSlug(source.slug);
    setBaseUrl(source.baseUrl);
    setRssUrl(source.rssUrl ?? '');
    setSourceType(source.sourceType);
    setCoverageScope(source.coverageScope ?? 'IRAN');
    setCredibilitySeed(String(source.credibilitySeed ?? 50));
    setShowForm(true);
    setFlash(null);
  }

  function resetForm() {
    setEditingId(null);
    setName('');
    setSlug('');
    setBaseUrl('https://');
    setRssUrl('');
    setSourceType('LOCAL_SPORTS_MEDIA');
    setCoverageScope('IRAN');
    setCredibilitySeed('70');
    setShowForm(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFlash(null);
    const body = {
      name: name.trim(),
      slug: (slug.trim() || toSlug(name)).toLowerCase(),
      sourceType,
      baseUrl: baseUrl.trim(),
      rssUrl: rssUrl.trim() || null,
      language: 'fa' as const,
      coverageScope,
      credibilitySeed: Number(credibilitySeed) || 50,
      priority: 40,
      fetchIntervalSec: 900,
      isActive: true,
    };
    try {
      if (editingId) {
        await apiFetch(`/sources/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: body.name,
            rssUrl: body.rssUrl,
            baseUrl: body.baseUrl,
            sourceType: body.sourceType,
            coverageScope: body.coverageScope,
            credibilitySeed: body.credibilitySeed,
            isActive: true,
          }),
        });
        setFlash('منبع به‌روز شد');
      } else {
        await apiFetch('/sources', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        setFlash('منبع اضافه شد — می‌توانید همین الان خزش را بزنید');
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ذخیره ناموفق');
    } finally {
      setSaving(false);
    }
  }

  async function crawl(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/sources/${id}/crawl`, { method: 'POST', body: '{}' });
      setFlash('خزش در صف قرار گرفت — چند دقیقه بعد صندوق را چک کنید');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خزش ناموفق');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(source: Source) {
    setBusyId(source.id);
    try {
      await apiFetch(`/sources/${source.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !source.isActive }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تغییر وضعیت ناموفق');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 pb-8 pt-6" dir="rtl">
      <PageHeader
        eyebrow="تنظیمات"
        title="منابع خبری"
        subtitle="ورزش۳، فوتبال۳۶۰، ایرنا و… را اینجا اضافه یا ویرایش کنید"
        action={
          <button
            type="button"
            onClick={() => {
              if (showForm) resetForm();
              else {
                setShowForm(true);
                setEditingId(null);
              }
            }}
            className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-ink"
          >
            {showForm ? 'بستن' : 'منبع جدید'}
          </button>
        }
      />

      <div className="mb-3 rounded-xl border border-fog/10 bg-black/10 px-3 py-2.5 text-[12px] leading-6 text-fog/65">
        برای سایت‌هایی مثل <strong className="text-fog/85">فوتبال۳۶۰</strong> اگر RSS عمومی
        نداشتند، آدرس RSS یا Sitemap را از خود سایت بگیرید و اینجا بگذارید. ورزش۳ آماده است:{' '}
        <code className="text-accent">varzesh3.com/rss/all</code>
      </div>

      {!showForm ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => applyPreset(p)}
              className="rounded-lg border border-accent/30 px-2.5 py-1.5 text-[11px] text-accent"
            >
              + {p.name}
            </button>
          ))}
        </div>
      ) : null}

      {flash ? (
        <p className="mb-3 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">
          {flash}
        </p>
      ) : null}
      {error ? (
        <p className="mb-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {showForm ? (
        <form
          onSubmit={onSubmit}
          className="mb-6 space-y-3 rounded-xl border border-fog/15 bg-black/15 p-4"
        >
          <h2 className="text-sm font-semibold">
            {editingId ? 'ویرایش منبع' : 'افزودن منبع'}
          </h2>
          <label className="block text-xs text-fog/60">
            نام نمایشی
            <input
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!editingId && !slug) setSlug(toSlug(e.target.value));
              }}
              className="mt-1 w-full rounded-lg border border-fog/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-accent/40"
              placeholder="مثلاً ورزش۳"
            />
          </label>
          <label className="block text-xs text-fog/60">
            شناسه انگلیسی (slug)
            <input
              required
              value={slug}
              disabled={Boolean(editingId)}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              className="mt-1 w-full rounded-lg border border-fog/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-accent/40 disabled:opacity-50"
              placeholder="varzesh3"
              pattern="[a-z0-9-]+"
            />
          </label>
          <label className="block text-xs text-fog/60">
            آدرس سایت
            <input
              required
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="mt-1 w-full rounded-lg border border-fog/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-accent/40"
            />
          </label>
          <label className="block text-xs text-fog/60">
            آدرس RSS (مهم)
            <input
              type="url"
              value={rssUrl}
              onChange={(e) => setRssUrl(e.target.value)}
              className="mt-1 w-full rounded-lg border border-fog/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-accent/40"
              placeholder="https://www.varzesh3.com/rss/all"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-fog/60">
              نوع
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-fog/15 bg-black/20 px-2 py-2 text-sm"
              >
                <option value="LOCAL_SPORTS_MEDIA">رسانه ورزشی</option>
                <option value="NEWS_AGENCY">خبرگزاری</option>
                <option value="TRUSTED_NEWSPAPER">روزنامه معتبر</option>
                <option value="TRANSFER_REPORTER">گزارشگر انتقال</option>
                <option value="OFFICIAL_CLUB">باشگاه رسمی</option>
                <option value="AGGREGATOR">تجمیع‌کننده</option>
              </select>
            </label>
            <label className="block text-xs text-fog/60">
              پوشش
              <select
                value={coverageScope}
                onChange={(e) => setCoverageScope(e.target.value)}
                className="mt-1 w-full rounded-lg border border-fog/15 bg-black/20 px-2 py-2 text-sm"
              >
                <option value="IRAN">ایران</option>
                <option value="EUROPE">اروپا</option>
                <option value="BOTH">هر دو</option>
                <option value="OTHER">سایر</option>
              </select>
            </label>
          </div>
          <label className="block text-xs text-fog/60">
            اعتبار منبع (seed · ۰–۱۰۰) — {credibilityTierLabel(Number(credibilitySeed))}
            <input
              type="number"
              min={0}
              max={100}
              value={credibilitySeed}
              onChange={(e) => setCredibilitySeed(e.target.value)}
              className="mt-1 w-full rounded-lg border border-fog/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-accent/40"
            />
            <span className="mt-1 block text-[11px] text-fog/40">
              این عدد در فرمول hybrid امتیاز خبر وارد می‌شود (نه فقط نمایشی).
            </span>
          </label>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-ink disabled:opacity-50"
          >
            {saving ? 'در حال ذخیره…' : editingId ? 'ذخیره تغییرات' : 'افزودن منبع'}
          </button>
        </form>
      ) : null}

      {loading ? <SkeletonList rows={4} /> : null}

      {!loading && items.length === 0 ? (
        <EmptyState
          title="هنوز منبعی نیست"
          description="از دکمه‌های میانبر بالا ورزش۳ یا ایرنا را اضافه کنید."
        />
      ) : null}

      {!loading ? (
        <ul className="space-y-3">
          {items.map((source) => (
            <li
              key={source.id}
              className="rounded-xl border border-fog/10 bg-black/15 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">{source.name}</h2>
                  <p className="mt-0.5 break-all text-[11px] text-fog/45">
                    {source.rssUrl || source.baseUrl}
                  </p>
                </div>
                <StatusBadge
                  label={source.isActive ? 'فعال' : 'خاموش'}
                  tone={source.isActive ? 'ok' : 'neutral'}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-fog/50">
                <StatusBadge label={labelHealth(source.health?.status)} />
                <span>{source.coverageScope === 'IRAN' ? 'ایران' : source.coverageScope}</span>
                <span>· {source.language ?? 'fa'}</span>
                <span>
                  · اعتبار {source.credibilitySeed ?? '—'} (
                  {credibilityTierLabel(source.credibilitySeed)})
                </span>
              </div>
              {source.health?.lastErrorMessage ? (
                <p className="mt-2 line-clamp-2 text-[11px] text-red-300/80">
                  {source.health.lastErrorMessage}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === source.id || !source.isActive}
                  onClick={() => void crawl(source.id)}
                  className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-ink disabled:opacity-40"
                >
                  {busyId === source.id ? '…' : 'استخراج الان'}
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(source)}
                  className="rounded-lg border border-fog/20 px-3 py-1.5 text-[11px]"
                >
                  ویرایش
                </button>
                <button
                  type="button"
                  disabled={busyId === source.id}
                  onClick={() => void toggleActive(source)}
                  className="rounded-lg border border-fog/20 px-3 py-1.5 text-[11px]"
                >
                  {source.isActive ? 'خاموش کردن' : 'فعال کردن'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
