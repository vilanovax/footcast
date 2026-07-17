'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { API_BASE, apiFetch, clearTokens, getToken } from '../../../lib/api';

type EpisodeDetail = {
  id: string;
  title: string;
  status: string;
  targetDurationMin: number;
  items?: Array<{
    eventId: string;
    sortOrder: number;
    event?: { title?: string; importanceScore?: number; status?: string };
  }>;
  scripts?: Array<{
    id: string;
    version: number;
    status: string;
    wordCount: number;
    estimatedDurationSec: number;
    bodyMd: string;
    factCheckJson?: { ok?: boolean; issues?: unknown[] } | null;
  }>;
  audios?: Array<{
    id: string;
    status: string;
    mimeType: string;
    publicUrl: string | null;
    durationSec: number;
    reportedDurationSec: number;
    fileSizeBytes: number;
    provider: string;
  }>;
  publication?: {
    id: string;
    audioUrl: string;
    publishedAt: string;
    guid: string;
  } | null;
  costSummary?: {
    requests: number;
    estimatedCost: number;
    inputTokens: number;
    outputTokens: number;
    tokens: number;
  };
};

async function pollUntil(
  id: string,
  done: (ep: EpisodeDetail) => boolean,
  attempts = 12,
  delayMs = 800,
): Promise<EpisodeDetail> {
  let last: EpisodeDetail | null = null;
  for (let i = 0; i < attempts; i += 1) {
    const current = await apiFetch<EpisodeDetail>(`/podcasts/${id}`);
    last = current.data;
    if (done(current.data)) return current.data;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  if (!last) throw new Error('پاسخی دریافت نشد');
  return last;
}

export default function PodcastDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [episode, setEpisode] = useState<EpisodeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    try {
      const res = await apiFetch<EpisodeDetail>(`/podcasts/${id}`);
      setEpisode(res.data);
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

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/podcasts/${id}/generate-script`, { method: 'POST', body: '{}' });
      const next = await pollUntil(
        id,
        (ep) =>
          ep.status === 'SCRIPT_READY' ||
          ep.status === 'SCRIPT_REVIEWED' ||
          ep.status === 'FAILED' ||
          (ep.scripts?.length ?? 0) > 0,
      );
      setEpisode(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تولید اسکریپت ناموفق');
    } finally {
      setBusy(false);
    }
  }

  async function approveScript() {
    setBusy(true);
    try {
      const res = await apiFetch<EpisodeDetail>(`/podcasts/${id}/approve-script`, {
        method: 'POST',
        body: '{}',
      });
      setEpisode(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تأیید اسکریپت ناموفق');
    } finally {
      setBusy(false);
    }
  }

  async function approveEpisode() {
    setBusy(true);
    try {
      const res = await apiFetch<EpisodeDetail>(`/podcasts/${id}/approve`, {
        method: 'POST',
        body: '{}',
      });
      setEpisode(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تأیید اپیزود ناموفق');
    } finally {
      setBusy(false);
    }
  }

  async function generateAudio() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/podcasts/${id}/generate-audio`, { method: 'POST', body: '{}' });
      const next = await pollUntil(
        id,
        (ep) =>
          ep.status === 'AUDIO_READY' ||
          ep.status === 'FAILED' ||
          (ep.audios?.some((a) => a.status === 'ready') ?? false),
        16,
        900,
      );
      setEpisode(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تولید صدا ناموفق');
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/podcasts/${id}/publish`, { method: 'POST', body: '{}' });
      const next = await pollUntil(
        id,
        (ep) => ep.status === 'PUBLISHED' || Boolean(ep.publication),
        12,
        700,
      );
      setEpisode(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'انتشار ناموفق');
    } finally {
      setBusy(false);
    }
  }

  const script = episode?.scripts?.[0];
  const audio = episode?.audios?.[0];
  const minutes = script ? Math.round((script.estimatedDurationSec / 60) * 10) / 10 : null;
  const audioSrc = `${API_BASE}/podcasts/${id}/audio/file`;
  const canAudio =
    episode?.status === 'APPROVED' ||
    episode?.status === 'SCRIPT_REVIEWED' ||
    episode?.status === 'AUDIO_READY' ||
    episode?.status === 'FAILED';
  const canPublish =
    episode?.status === 'AUDIO_READY' ||
    episode?.status === 'PUBLISHED' ||
    Boolean(audio?.status === 'ready');

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 pb-36 pt-5" dir="rtl">
      <Link href="/podcasts" className="text-xs text-fog/55">
        ← لیست اپیزودها
      </Link>

      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {!episode ? <p className="mt-8 text-sm text-fog/60">بارگذاری...</p> : null}

      {episode ? (
        <>
          <h1 className="mt-4 font-display text-xl font-bold">{episode.title}</h1>
          <p className="mt-1 text-xs text-fog/55">
            {episode.status} · هدف {episode.targetDurationMin} دقیقه
            {episode.costSummary ? (
              <>
                {' '}
                · هزینه ~${episode.costSummary.estimatedCost.toFixed(4)} ·{' '}
                {episode.costSummary.tokens} توکن
              </>
            ) : null}
          </p>

          <section className="mt-6">
            <h2 className="text-xs font-semibold text-fog/50">اخبار انتخاب‌شده</h2>
            <ul className="mt-2 space-y-2">
              {(episode.items ?? []).map((item) => (
                <li
                  key={item.eventId}
                  className="rounded-lg border border-fog/10 bg-black/10 px-3 py-2 text-xs"
                >
                  <div className="font-medium text-fog/85">{item.event?.title}</div>
                  <div className="mt-1 text-fog/45">
                    امتیاز {item.event?.importanceScore ?? '—'} · {item.event?.status}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {script ? (
            <section className="mt-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-fog/50">
                  اسکریپت v{script.version}
                </h2>
                <span className="text-[11px] text-accent">
                  {script.wordCount} واژه · ~{minutes} دقیقه
                </span>
              </div>
              {script.factCheckJson ? (
                <p className="mt-1 text-[11px] text-fog/50">
                  fact-check: {script.factCheckJson.ok ? 'OK' : 'نیاز به بازبینی'} (
                  {script.factCheckJson.issues?.length ?? 0} مورد)
                </p>
              ) : null}
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-fog/10 bg-black/20 p-3 text-xs leading-6 text-fog/80">
                {script.bodyMd}
              </pre>
            </section>
          ) : null}

          {audio?.status === 'ready' ? (
            <section className="mt-6">
              <h2 className="text-xs font-semibold text-fog/50">پخش صدا</h2>
              <p className="mt-1 text-[11px] text-fog/45">
                {audio.provider} · ~{Math.round(audio.reportedDurationSec / 60)} دقیقه ·{' '}
                {Math.round(audio.fileSizeBytes / 1024)} KB
              </p>
              <audio
                key={audio.id}
                controls
                className="mt-3 w-full"
                preload="metadata"
                src={audioSrc}
              >
                مرورگر شما از پخش صدا پشتیبانی نمی‌کند.
              </audio>
              {episode.publication ? (
                <p className="mt-2 text-[11px] text-accent">
                  منتشر شده · {new Date(episode.publication.publishedAt).toLocaleString('fa-IR')}
                </p>
              ) : null}
              <a
                href={`${API_BASE}/podcasts/rss.xml`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-[11px] text-fog/55 underline"
              >
                RSS feed
              </a>
            </section>
          ) : null}

          <div className="fixed inset-x-0 bottom-0 border-t border-fog/10 bg-[#0a2f24]/95 px-4 py-3 backdrop-blur">
            <div className="mx-auto grid max-w-lg grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void generate()}
                className="rounded-lg border border-accent/40 py-2.5 text-xs font-semibold text-accent disabled:opacity-50"
              >
                تولید اسکریپت
              </button>
              <button
                type="button"
                disabled={busy || !script}
                onClick={() => void approveScript()}
                className="rounded-lg border border-fog/25 py-2.5 text-xs font-semibold disabled:opacity-50"
              >
                تأیید اسکریپت
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void approveEpisode()}
                className="rounded-lg border border-fog/25 py-2.5 text-xs font-semibold disabled:opacity-50"
              >
                تأیید اپیزود
              </button>
              <button
                type="button"
                disabled={busy || !canAudio}
                onClick={() => void generateAudio()}
                className="rounded-lg border border-accent/40 py-2.5 text-xs font-semibold text-accent disabled:opacity-50"
              >
                تولید صدا
              </button>
              <button
                type="button"
                disabled={busy || !canPublish}
                onClick={() => void publish()}
                className="col-span-2 rounded-lg bg-accent py-2.5 text-xs font-semibold text-ink disabled:opacity-50"
              >
                انتشار
              </button>
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}
