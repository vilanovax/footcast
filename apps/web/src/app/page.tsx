import Link from 'next/link';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1';

async function fetchHealth(): Promise<{ status?: string } | null> {
  try {
    const res = await fetch(`${apiBase}/health/live`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { status?: string }; status?: string };
    return json.data ?? json;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const health = await fetchHealth();
  const apiOnline = Boolean(health?.status);

  return (
    <main className="relative min-h-screen overflow-hidden" dir="rtl">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -left-20 top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-fog/10 blur-3xl" />
      </div>

      <section className="relative mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
        <p className="mb-3 text-sm font-medium tracking-wide text-accent">اتاق خبر فوتبال</p>
        <h1 className="font-display text-4xl font-bold leading-tight md:text-6xl">
          از خبر تا پادکست، در دو گام
        </h1>
        <p className="mt-5 max-w-xl text-base leading-8 text-fog/85 md:text-lg">
          اخبار فوتبال را در صندوق بررسی کنید، بعد همان‌جا اپیزود بسازید و منتشر کنید — بدون شلوغی
          منوهای فنی.
        </p>

        <ol className="mt-10 space-y-3 text-sm text-fog/80">
          <li className="flex gap-3 rounded-xl border border-fog/10 bg-black/15 px-4 py-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-ink">
              ۱
            </span>
            <span>
              <strong className="text-fog">بررسی خبر:</strong> در صندوق تأیید یا رد کنید
            </span>
          </li>
          <li className="flex gap-3 rounded-xl border border-fog/10 bg-black/15 px-4 py-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-ink">
              ۲
            </span>
            <span>
              <strong className="text-fog">ساخت پادکست:</strong> از اخبار تأییدشده اپیزود بسازید
            </span>
          </li>
          <li className="flex gap-3 rounded-xl border border-fog/10 bg-black/15 px-4 py-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-ink">
              ۳
            </span>
            <span>
              <strong className="text-fog">انتشار:</strong> متن → صدا → انتشار اپیزود
            </span>
          </li>
        </ol>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-ink transition hover:brightness-110"
          >
            ورود به میز کار
          </Link>
          <Link
            href="/work"
            className="rounded-xl border border-fog/30 px-5 py-3.5 text-sm font-semibold text-fog transition hover:bg-white/5"
          >
            اگر وارد شده‌اید → کار امروز
          </Link>
        </div>

        <p className="mt-8 text-xs text-fog/45">
          وضعیت سامانه:{' '}
          <span className={apiOnline ? 'text-emerald-300' : 'text-red-300'}>
            {apiOnline ? 'آنلاین' : 'آفلاین'}
          </span>
        </p>
      </section>
    </main>
  );
}
