'use client';

import { PODCAST_STEPS, type PodcastStepId } from '../lib/labels';

export function PodcastStepper({
  stepIndex,
  done,
}: {
  stepIndex: number;
  done: boolean;
}) {
  return (
    <ol className="mt-4 flex items-start gap-1" aria-label="مراحل ساخت اپیزود">
      {PODCAST_STEPS.map((step, i) => {
        const complete = done || i < stepIndex;
        const current = !done && i === stepIndex;
        return (
          <li key={step.id} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                complete
                  ? 'bg-accent/80 text-ink'
                  : current
                    ? 'bg-accent text-ink ring-2 ring-accent/40'
                    : 'border border-fog/25 text-fog/40'
              }`}
            >
              {complete ? '✓' : i + 1}
            </div>
            <span
              className={`text-center text-[10px] leading-tight ${
                current ? 'font-semibold text-accent' : 'text-fog/45'
              }`}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function NextActionBar({
  hint,
  label,
  busy,
  busyLabel,
  onAction,
  disabled,
}: {
  hint: string;
  label: string | null;
  busy: boolean;
  busyLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-fog/10 bg-[#0a2f24]/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
      <div className="mx-auto max-w-lg">
        <p className="mb-2 text-center text-[11px] text-fog/55">{hint}</p>
        {label ? (
          <button
            type="button"
            disabled={busy || disabled}
            onClick={onAction}
            className="w-full rounded-xl bg-accent py-3.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? busyLabel ?? 'لطفاً صبر کنید…' : label}
          </button>
        ) : (
          <div className="rounded-xl border border-fog/15 py-3.5 text-center text-sm text-fog/60">
            {busy ? busyLabel ?? 'در حال پردازش…' : 'مرحله‌ای باقی نمانده'}
          </div>
        )}
      </div>
    </div>
  );
}

export type { PodcastStepId };
