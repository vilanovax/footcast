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

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -left-20 top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-fog/10 blur-3xl" />
      </div>

      <section className="relative mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
        <p className="mb-3 text-sm tracking-[0.2em] text-accent">FOOTBALL NEWSROOM</p>
        <h1 className="font-display text-5xl font-bold leading-tight md:text-7xl">اتاق خبر فوتبال</h1>
        <p className="mt-5 max-w-xl text-lg text-fog/90">
          پلتفرم سردبیری هوشمند برای جمع‌آوری، رتبه‌بندی و تبدیل اخبار فوتبال ایران و اروپا به
          پادکست خبری.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <a
            href="/inbox"
            className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-ink transition hover:brightness-110"
          >
            صندوق ورودی سردبیر
          </a>
          <a
            href="/login"
            className="rounded-xl border border-fog/30 px-5 py-3 text-sm font-semibold text-fog transition hover:bg-white/5"
          >
            ورود
          </a>
          <a
            href={`${apiBase.replace('/api/v1', '')}/api/docs`}
            className="rounded-xl border border-fog/20 px-5 py-3 text-sm font-semibold text-fog/80 transition hover:bg-white/5"
          >
            API Docs
          </a>
        </div>

        <dl className="mt-14 grid max-w-2xl grid-cols-2 gap-4 text-sm text-fog/80 md:grid-cols-3">
          <div>
            <dt className="text-fog/50">وضعیت API</dt>
            <dd className="mt-1 font-semibold text-white">{health?.status ?? 'offline'}</dd>
          </div>
          <div>
            <dt className="text-fog/50">فاز جاری</dt>
            <dd className="mt-1 font-semibold text-white">Editorial Inbox</dd>
          </div>
          <div>
            <dt className="text-fog/50">پلتفرم</dt>
            <dd className="mt-1 font-semibold text-white">PWA / RTL</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
