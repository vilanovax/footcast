'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, setTokens } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@football-newsroom.local');
  const [password, setPassword] = useState('ChangeMeAdmin123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      router.push('/inbox');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ورود ناموفق');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10" dir="rtl">
      <p className="text-xs tracking-[0.25em] text-accent">FOOTBALL NEWSROOM</p>
      <h1 className="mt-2 font-display text-3xl font-bold">ورود سردبیر</h1>
      <p className="mt-2 text-sm text-fog/70">برای صندوق ورودی خبر وارد شوید.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block text-sm">
          <span className="text-fog/60">ایمیل</span>
          <input
            className="mt-1 w-full rounded-lg border border-fog/20 bg-black/20 px-3 py-2.5 outline-none ring-accent focus:ring-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-fog/60">رمز</span>
          <input
            className="mt-1 w-full rounded-lg border border-fog/20 bg-black/20 px-3 py-2.5 outline-none ring-accent focus:ring-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </label>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-ink disabled:opacity-60"
        >
          {loading ? '...' : 'ورود به صندوق'}
        </button>
      </form>
    </main>
  );
}
