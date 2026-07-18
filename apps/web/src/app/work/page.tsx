'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, clearTokens, getToken } from '../../lib/api';
import { WorkflowGuide } from '../../components/WorkflowGuide';

type NextAction = {
  step: 1 | 2 | 3;
  title: string;
  body: string;
  cta: string;
  href: string;
  tone: 'primary' | 'secondary';
};

export default function WorkDeskPage() {
  const router = useRouter();
  const [reviewCount, setReviewCount] = useState(0);
  const [readyCount, setReadyCount] = useState(0);
  const [episodeOpen, setEpisodeOpen] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [inbox, rundown, podcasts] = await Promise.all([
        apiFetch<unknown[]>('/editorial/inbox?status=NEEDS_REVIEW&pageSize=1'),
        apiFetch<{ activeItemCount?: number }>('/rundown/today'),
        apiFetch<Array<{ status?: string }>>('/podcasts?pageSize=30'),
      ]);
      setReviewCount(inbox.meta?.total ?? 0);
      setReadyCount(rundown.data?.activeItemCount ?? 0);
      const eps = Array.isArray(podcasts.data) ? podcasts.data : [];
      setEpisodeOpen(
        eps.filter((e) => {
          const s = e.status ?? '';
          return s && s !== 'PUBLISHED' && s !== 'ARCHIVED';
        }).length,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'خطا';
      setError(message);
      if (!getToken() || /unauthorized|jwt|token/i.test(message)) {
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

  const next = useMemo((): NextAction => {
    if (reviewCount > 0) {
      return {
        step: 1,
        title: `${reviewCount.toLocaleString('fa-IR')} خبر در inbox منتظر بررسی است`,
        body: 'خبر را بخوان → تأیید کن تا برود Today. برای خبر تازه از دکمهٔ «جستجوی خبر الان» در inbox استفاده کن.',
        cta: 'باز کردن inbox',
        href: '/inbox',
        tone: 'primary',
      };
    }
    if (readyCount > 0) {
      return {
        step: 2,
        title: `${readyCount.toLocaleString('fa-IR')} خبر در Today`,
        body: 'توازن پوشش را چک کن، نزدیک ۱۶:۰۰ قفل کن، بعد اپیزود بساز.',
        cta: 'باز کردن Today',
        href: '/rundown',
        tone: 'primary',
      };
    }
    if (episodeOpen > 0) {
      return {
        step: 2,
        title: `${episodeOpen.toLocaleString('fa-IR')} اپیزود ناتمام دارید`,
        body: 'اپیزودهای در حال ساخت را تمام کنید تا به انتشار برسید.',
        cta: 'ادامهٔ پادکست‌ها',
        href: '/podcasts',
        tone: 'primary',
      };
    }
    return {
      step: 1,
      title: 'فعلاً خبری برای بررسی نیست',
      body: 'صبر کنید خزش خبر جدید بیاورد، یا منابع را چک کنید. وقتی خبر آمد همین‌جا دکمهٔ شروع ظاهر می‌شود.',
      cta: 'رفتن به منابع',
      href: '/sources',
      tone: 'secondary',
    };
  }, [reviewCount, readyCount, episodeOpen]);

  const activeStep =
    next.step === 1 ? 'review' : next.step === 2 ? 'podcast' : 'publish';

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 pb-24 pt-5" dir="rtl">
      <header className="mb-4">
        <p className="text-[11px] font-medium tracking-wide text-accent">میز کار امروز</p>
        <h1 className="font-display text-2xl font-bold">از کجا شروع کنم؟</h1>
        <p className="mt-1.5 text-xs leading-6 text-fog/55">
          کار سردبیر فقط سه مرحله است. بقیهٔ منوها ابزار فنی‌اند — لازم نیست هر روز باز شوند.
        </p>
      </header>

      <WorkflowGuide
        activeOverride={activeStep as 'review' | 'podcast' | 'publish'}
        counts={{
          review: reviewCount,
          ready: readyCount,
          episodes: episodeOpen,
        }}
      />

      {error ? (
        <p className="mb-3 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      ) : null}

      {/* Primary next action */}
      <section
        className={`rounded-2xl border px-4 py-4 ${
          next.tone === 'primary'
            ? 'border-accent/35 bg-accent/10'
            : 'border-fog/12 bg-black/20'
        }`}
      >
        <div className="flex items-center gap-2 text-[11px] text-fog/50">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-ink">
            {next.step}
          </span>
          گام بعدی
        </div>
        {loading ? (
          <div className="mt-3 animate-pulse space-y-2">
            <div className="h-5 w-3/4 rounded bg-fog/10" />
            <div className="h-4 w-full rounded bg-fog/5" />
          </div>
        ) : (
          <>
            <h2 className="mt-2 text-base font-semibold leading-7 text-fog">
              {next.title}
            </h2>
            <p className="mt-1.5 text-xs leading-6 text-fog/60">{next.body}</p>
            <Link
              href={next.href}
              className={`mt-4 flex w-full items-center justify-center rounded-xl py-3.5 text-sm font-bold transition active:scale-[0.99] ${
                next.tone === 'primary'
                  ? 'bg-accent text-ink'
                  : 'border border-fog/20 text-fog/85'
              }`}
            >
              {next.cta}
            </Link>
          </>
        )}
      </section>

      {/* Step cards */}
      <section className="mt-5 space-y-2">
        <h3 className="px-1 text-[11px] font-semibold text-fog/45">مسیر کامل</h3>
        <StepCard
          n={1}
          title="inbox"
          done={reviewCount === 0 && readyCount + episodeOpen > 0}
          count={reviewCount}
          countLabel="در انتظار"
          href="/inbox"
          active={next.step === 1 && reviewCount > 0}
        />
        <StepCard
          n={2}
          title="Today تا ۱۶:۰۰"
          done={false}
          count={readyCount}
          countLabel="در Today"
          href="/rundown"
          active={next.step === 2}
        />
        <StepCard
          n={3}
          title="ساخت و انتشار پادکست"
          done={false}
          count={episodeOpen}
          countLabel="اپیزود ناتمام"
          href="/podcasts"
          active={next.step === 3}
        />
      </section>

      {/* Advanced tools — demoted */}
      <details className="mt-6 rounded-2xl border border-fog/10 bg-black/15 px-3 py-2">
        <summary className="cursor-pointer list-none py-2 text-xs text-fog/55 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between">
            ابزارهای فنی (اختیاری)
            <span className="text-fog/35">▾</span>
          </span>
        </summary>
        <ul className="fn-fade-in space-y-1 border-t border-fog/10 pb-2 pt-2">
          <ToolLink href="/waves" title="محتوا" hint="دلتای موج استخراج" />
          <ToolLink href="/sources" title="منابع خبر" hint="خزش و RSS" />
          <ToolLink
            href="/admin/clustering-evaluation"
            title="ارزیابی Clustering"
            hint="کیفیت ادغام خبرها"
          />
          <ToolLink href="/dashboard" title="گزارش عملیات" hint="هزینه، صف، خطا" />
        </ul>
      </details>

      <button
        type="button"
        onClick={() => void load()}
        className="mt-4 w-full text-center text-[11px] text-fog/40 underline"
      >
        بروزرسانی اعداد
      </button>
    </main>
  );
}

function StepCard({
  n,
  title,
  count,
  countLabel,
  href,
  active,
  done,
}: {
  n: number;
  title: string;
  count: number;
  countLabel: string;
  href: string;
  active?: boolean;
  done?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-2xl border px-3 py-3 transition ${
        active
          ? 'border-accent/40 bg-accent/10'
          : 'border-fog/10 bg-black/15 hover:border-fog/20'
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          done
            ? 'bg-emerald-400/20 text-emerald-200'
            : active
              ? 'bg-accent text-ink'
              : 'border border-fog/20 text-fog/45'
        }`}
      >
        {done ? '✓' : n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-fog/90">{title}</div>
        <div className="mt-0.5 text-[11px] text-fog/45">
          {count > 0
            ? `${count.toLocaleString('fa-IR')} ${countLabel}`
            : 'فعلاً خالی'}
        </div>
      </div>
      <span className="text-[11px] text-fog/35">باز کردن</span>
    </Link>
  );
}

function ToolLink({
  href,
  title,
  hint,
}: {
  href: string;
  title: string;
  hint: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between rounded-xl px-2 py-2.5 text-xs hover:bg-fog/5"
      >
        <span>
          <span className="font-medium text-fog/80">{title}</span>
          <span className="mt-0.5 block text-[10px] text-fog/40">{hint}</span>
        </span>
        <span className="text-fog/30">←</span>
      </Link>
    </li>
  );
}
