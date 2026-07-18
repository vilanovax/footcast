'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { API_BASE, apiFetch, clearTokens, getToken } from '../../../lib/api';
import { formatJalali } from '../../../lib/dates';
import {
  episodeStatusTone,
  labelEpisodeStatus,
  labelEventStatus,
  podcastProgress,
  type PodcastStepId,
} from '../../../lib/labels';
import { NextActionBar, PodcastStepper } from '../../../components/PodcastStepper';
import { StatusBadge } from '../../../components/StatusBadge';

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
  const [busyLabel, setBusyLabel] = useState('لطفاً صبر کنید…');

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

  async function runAction(action: PodcastStepId) {
    setBusy(true);
    setError(null);
    try {
      if (action === 'script') {
        setBusyLabel('در حال نوشتن متن…');
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
      } else if (action === 'review') {
        setBusyLabel('تأیید متن…');
        const res = await apiFetch<EpisodeDetail>(`/podcasts/${id}/approve-script`, {
          method: 'POST',
          body: '{}',
        });
        setEpisode(res.data);
      } else if (action === 'approve') {
        setBusyLabel('تأیید اپیزود…');
        const res = await apiFetch<EpisodeDetail>(`/podcasts/${id}/approve`, {
          method: 'POST',
          body: '{}',
        });
        setEpisode(res.data);
      } else if (action === 'audio') {
        setBusyLabel('در حال ساخت صدا…');
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
      } else if (action === 'publish') {
        setBusyLabel('در حال انتشار…');
        await apiFetch(`/podcasts/${id}/publish`, { method: 'POST', body: '{}' });
        const next = await pollUntil(
          id,
          (ep) => ep.status === 'PUBLISHED' || Boolean(ep.publication),
          12,
          700,
        );
        setEpisode(next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'عملیات ناموفق');
    } finally {
      setBusy(false);
    }
  }

  const script = episode?.scripts?.[0];
  const audio = episode?.audios?.[0];
  const minutes = script ? Math.round((script.estimatedDurationSec / 60) * 10) / 10 : null;
  const audioSrc = `${API_BASE}/podcasts/${id}/audio/file`;
  const progress = podcastProgress(episode?.status);

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 pb-36 pt-5" dir="rtl">
      <Link
        href="/podcasts"
        className="inline-flex items-center gap-1 text-xs text-fog/55 hover:text-fog/80"
      >
        <span aria-hidden>→</span> لیست اپیزودها
      </Link>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {!episode ? (
        <div className="mt-8 animate-pulse space-y-3">
          <div className="h-6 w-3/4 rounded bg-fog/10" />
          <div className="h-16 w-full rounded-xl bg-fog/5" />
        </div>
      ) : null}

      {episode ? (
        <>
          <h1 className="mt-4 font-display text-xl font-bold">{episode.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge
              label={labelEpisodeStatus(episode.status)}
              tone={episodeStatusTone(episode.status)}
            />
            <span className="text-[11px] text-fog/50">
              هدف {episode.targetDurationMin.toLocaleString('fa-IR')} دقیقه
            </span>
            {episode.costSummary ? (
              <span className="text-[11px] text-fog/40">
                · هزینه ~${episode.costSummary.estimatedCost.toFixed(4)}
              </span>
            ) : null}
          </div>

          <div className="mt-5 rounded-xl border border-fog/10 bg-black/15 px-3 py-4">
            <p className="text-center text-[11px] text-fog/50">پیشرفت ساخت</p>
            <PodcastStepper stepIndex={progress.stepIndex} done={progress.done} />
          </div>

          <section className="mt-6">
            <h2 className="text-xs font-semibold text-fog/50">اخبار این اپیزود</h2>
            <ul className="mt-2 space-y-2">
              {(episode.items ?? []).length === 0 ? (
                <li className="text-xs text-fog/45">خبری انتخاب نشده</li>
              ) : (
                (episode.items ?? []).map((item) => (
                  <li
                    key={item.eventId}
                    className="rounded-lg border border-fog/10 bg-black/10 px-3 py-2 text-xs"
                  >
                    <div className="font-medium text-fog/85">{item.event?.title}</div>
                    <div className="mt-1 text-fog/45">
                      امتیاز{' '}
                      {item.event?.importanceScore?.toLocaleString('fa-IR') ?? '—'} ·{' '}
                      {labelEventStatus(item.event?.status)}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>

          {script ? (
            <section className="mt-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-fog/50">
                  متن اپیزود (نسخه {script.version.toLocaleString('fa-IR')})
                </h2>
                <span className="text-[11px] text-accent">
                  {script.wordCount.toLocaleString('fa-IR')} واژه · ~
                  {minutes?.toLocaleString('fa-IR')} دقیقه
                </span>
              </div>
              {script.factCheckJson ? (
                <p className="mt-1 text-[11px] text-fog/50">
                  راستی‌آزمایی:{' '}
                  {script.factCheckJson.ok ? 'مورد مشکوکی نبود' : 'نیاز به بازبینی'} (
                  {(script.factCheckJson.issues?.length ?? 0).toLocaleString('fa-IR')} مورد)
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
                ~{Math.round(audio.reportedDurationSec / 60).toLocaleString('fa-IR')} دقیقه ·{' '}
                {Math.round(audio.fileSizeBytes / 1024).toLocaleString('fa-IR')} کیلوبایت
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
                  منتشر شده · {formatJalali(episode.publication.publishedAt)}
                </p>
              ) : null}
              <a
                href={`${API_BASE}/podcasts/rss.xml`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-[11px] text-fog/55 underline"
              >
                خوراک RSS
              </a>
            </section>
          ) : null}

          <NextActionBar
            hint={progress.hint}
            label={progress.nextLabel}
            busy={busy}
            busyLabel={busyLabel}
            onAction={
              progress.nextAction ? () => void runAction(progress.nextAction!) : undefined
            }
          />
        </>
      ) : null}
    </main>
  );
}
