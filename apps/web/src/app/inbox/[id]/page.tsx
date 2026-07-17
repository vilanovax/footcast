'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch, clearTokens, getToken } from '../../../lib/api';

type EventDetail = {
  id: string;
  title: string;
  summary?: string | null;
  status: string;
  scope?: string | null;
  category?: string | null;
  officialStatus?: string | null;
  importanceScore?: number | null;
  articleCount?: number;
  scores?: Array<{
    finalScore: number;
    ruleHits?: string[];
    factors?: Record<string, number>;
    penalties?: Record<string, number>;
  }>;
  notes?: Array<{ id: string; body: string; createdAt?: string }>;
  articles?: Array<{
    role?: string;
    article?: { title?: string; canonicalUrl?: string; status?: string };
  }>;
  conflicts?: Array<{ id: string; status: string; conflictType: string }>;
};

export default function InboxDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    try {
      const res = await apiFetch<EventDetail>(`/editorial/events/${id}`);
      setEvent(res.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'خطا';
      setError(message);
      if (/unauthorized|jwt|token/i.test(message)) {
        clearTokens();
        router.replace('/login');
      }
    }
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(decision: 'approve' | 'reject') {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/editorial/events/${id}/${decision}`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در تصمیم');
    } finally {
      setBusy(false);
    }
  }

  async function score() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/editorial/events/${id}/score?sync=1`, { method: 'POST', body: '{}' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در امتیاز');
    } finally {
      setBusy(false);
    }
  }

  async function saveNote() {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/editorial/events/${id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body: note }),
      });
      setNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در یادداشت');
    } finally {
      setBusy(false);
    }
  }

  const latest = event?.scores?.[0];

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 pb-28 pt-5" dir="rtl">
      <Link href="/inbox" className="text-xs text-fog/55">
        ← بازگشت به صندوق
      </Link>

      {!event && !error ? <p className="mt-8 text-sm text-fog/60">بارگذاری...</p> : null}
      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      {event ? (
        <>
          <div className="mt-4 flex items-start justify-between gap-3">
            <h1 className="font-display text-xl font-bold leading-snug">{event.title}</h1>
            <span className="shrink-0 rounded-md bg-accent/20 px-2.5 py-1 text-sm font-bold text-accent">
              {latest?.finalScore ?? event.importanceScore ?? '—'}
            </span>
          </div>
          <p className="mt-2 text-xs text-fog/55">
            {event.status} · {event.category ?? '—'} · {event.scope ?? '—'} ·{' '}
            {event.officialStatus ?? '—'}
          </p>
          {event.summary ? (
            <p className="mt-4 text-sm leading-7 text-fog/85">{event.summary}</p>
          ) : null}

          {latest?.ruleHits && latest.ruleHits.length > 0 ? (
            <section className="mt-6">
              <h2 className="text-xs font-semibold text-fog/50">قوانین فعال</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {latest.ruleHits.map((hit) => (
                  <span
                    key={hit}
                    className="rounded-md border border-fog/15 px-2 py-0.5 text-[11px] text-fog/70"
                  >
                    {hit}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-6">
            <h2 className="text-xs font-semibold text-fog/50">مقالات متصل</h2>
            <ul className="mt-2 space-y-2">
              {(event.articles ?? []).map((link, idx) => (
                <li key={idx} className="rounded-lg border border-fog/10 bg-black/10 px-3 py-2 text-xs">
                  <div className="text-fog/80">{link.article?.title ?? 'بدون عنوان'}</div>
                  <div className="mt-1 text-fog/45">
                    {link.role} · {link.article?.status}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-6">
            <h2 className="text-xs font-semibold text-fog/50">یادداشت سردبیر</h2>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-lg border border-fog/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-accent/40"
              placeholder="یادداشت کوتاه..."
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveNote()}
              className="mt-2 text-xs text-accent underline"
            >
              ذخیره یادداشت
            </button>
            <ul className="mt-3 space-y-2">
              {(event.notes ?? []).map((n) => (
                <li key={n.id} className="text-xs leading-6 text-fog/70">
                  {n.body}
                </li>
              ))}
            </ul>
          </section>

          <div className="fixed inset-x-0 bottom-0 border-t border-fog/10 bg-[#0a2f24]/95 px-4 py-3 backdrop-blur">
            <div className="mx-auto flex max-w-lg gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void decide('reject')}
                className="flex-1 rounded-lg border border-fog/25 py-3 text-sm font-semibold disabled:opacity-50"
              >
                رد
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void score()}
                className="rounded-lg border border-accent/40 px-3 py-3 text-xs text-accent disabled:opacity-50"
              >
                امتیاز
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void decide('approve')}
                className="flex-1 rounded-lg bg-accent py-3 text-sm font-semibold text-ink disabled:opacity-50"
              >
                تأیید
              </button>
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}
