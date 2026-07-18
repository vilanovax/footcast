'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getToken, setTokens } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getToken()) router.replace('/work');
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{
        tokens: { accessToken: string; refreshToken: string };
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setTokens(res.data.tokens.accessToken, res.data.tokens.refreshToken);
      router.push('/work');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ورود ناموفق');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10" dir="rtl">
      <p className="text-xs font-medium tracking-wide text-accent">اتاق خبر فوتبال</p>
      <h1 className="mt-2 font-display text-3xl font-bold">ورود سردبیر</h1>
      <p className="mt-2 text-sm leading-6 text-fog/70">
        بعد از ورود وارد <strong className="text-fog/90">میز کار</strong> می‌شوید و همان‌جا
        می‌بینید گام بعدی چیست: بررسی خبر → پادکست → انتشار.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block text-sm">
          <span className="text-fog/60">ایمیل</span>
          <input
            className="mt-1 w-full rounded-lg border border-fog/20 bg-black/20 px-3 py-2.5 outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/40"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="username"
            placeholder="admin@football-newsroom.local"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-fog/60">رمز عبور</span>
          <input
            className="mt-1 w-full rounded-lg border border-fog/20 bg-black/20 px-3 py-2.5 outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/40"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {error ? (
          <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-accent px-4 py-3.5 text-sm font-semibold text-ink disabled:opacity-60"
        >
          {loading ? 'در حال ورود…' : 'ورود به میز کار'}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-fog/45">
        <Link href="/" className="underline-offset-2 hover:text-fog/70 hover:underline">
          بازگشت به صفحهٔ معرفی
        </Link>
      </p>
    </main>
  );
}
