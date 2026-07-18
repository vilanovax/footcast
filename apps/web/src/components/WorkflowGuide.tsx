'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type WorkflowStepId = 'review' | 'podcast' | 'publish';

const STEPS: Array<{
  id: WorkflowStepId;
  n: number;
  label: string;
  href: string;
  match: (path: string) => boolean;
}> = [
  {
    id: 'review',
    n: 1,
    label: 'inbox',
    href: '/inbox',
    match: (p) => p.startsWith('/inbox') || p.startsWith('/waves'),
  },
  {
    id: 'podcast',
    n: 2,
    label: 'Today',
    href: '/rundown',
    match: (p) => p.startsWith('/rundown'),
  },
  {
    id: 'publish',
    n: 3,
    label: 'پادکست',
    href: '/podcasts',
    match: (p) => p.startsWith('/podcasts'),
  },
];

/** Compact 3-step editorial path — wave → rundown → publish. */
export function WorkflowGuide({
  counts,
  activeOverride,
}: {
  counts?: { review?: number; ready?: number; episodes?: number };
  activeOverride?: WorkflowStepId;
}) {
  const pathname = usePathname();
  const active =
    activeOverride ??
    (STEPS.find((s) => s.match(pathname))?.id ?? 'review');

  return (
    <nav
      aria-label="مسیر کار سردبیر"
      className="mb-4 rounded-2xl border border-fog/10 bg-black/20 px-2.5 py-2.5"
    >
      <ol className="flex items-stretch gap-1">
        {STEPS.map((step, i) => {
          const isActive = step.id === active;
          const count =
            step.id === 'review'
              ? counts?.review
              : step.id === 'podcast'
                ? counts?.ready
                : counts?.episodes;
          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-center gap-1">
              {i > 0 ? (
                <span className="shrink-0 text-[10px] text-fog/25" aria-hidden>
                  ←
                </span>
              ) : null}
              <Link
                href={step.href}
                className={`flex min-w-0 flex-1 flex-col items-center rounded-xl px-1 py-2 text-center transition ${
                  isActive
                    ? 'bg-accent/15 ring-1 ring-accent/35'
                    : 'hover:bg-fog/5'
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                    isActive ? 'bg-accent text-ink' : 'border border-fog/20 text-fog/45'
                  }`}
                >
                  {step.n}
                </span>
                <span
                  className={`mt-1 truncate text-[10px] leading-tight ${
                    isActive ? 'font-semibold text-accent' : 'text-fog/50'
                  }`}
                >
                  {step.label}
                </span>
                {count != null && count > 0 ? (
                  <span className="mt-0.5 text-[9px] tabular-nums text-fog/40">
                    {count.toLocaleString('fa-IR')}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
