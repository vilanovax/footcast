const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1';

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10" dir="rtl">
      <h1 className="text-3xl font-bold">داشبورد</h1>
      <p className="mt-3 max-w-2xl text-fog/80">
        اسکلت فاز صفر آماده است. پس از login در API می‌توانید آمار منابع و مقالات را از{' '}
        <code className="rounded bg-black/30 px-1">{apiBase}/dashboard</code> بخوانید.
      </p>
      <ul className="mt-8 space-y-3 text-sm text-fog/90">
        <li>منبع نمونه در seed: IRNA Sports Sample</li>
        <li>کاربر ادمین: admin@football-newsroom.local</li>
        <li>Swagger: /api/docs</li>
      </ul>
    </main>
  );
}
