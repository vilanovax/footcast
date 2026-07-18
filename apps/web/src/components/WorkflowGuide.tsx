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

/** Slim 3-step editorial path — inbox → Today → podcast. */
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
      className="mb-3 flex items-center gap-0.5 rounded-xl border border-fog/10 bg-black/20 p-1"
    >
      {STEPS.map((step, i) => {
        const isActive = step.id === active;
        const count =
          step.id === 'review'
            ? counts?.review
            : step.id === 'podcast'
              ? counts?.ready
              : counts?.episodes;
        return (
          <div key={step.id} className="flex min-w-0 flex-1 items-center">
            {i > 0 ? (
              <span
                className="mx-0.5 shrink-0 text-[9px] text-fog/20"
                aria-hidden
              >
                ‹
              </span>
            ) : null}
            <Link
              href={step.href}
              aria-current={isActive ? 'step' : undefined}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-1.5 py-1.5 transition ${
                isActive
                  ? 'bg-accent/18 text-accent ring-1 ring-accent/35'
                  : 'text-fog/50 hover:bg-fog/5 hover:text-fog/75'
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-accent text-ink' : 'bg-fog/10 text-fog/45'
                }`}
              >
                {step.n}
              </span>
              <span
                className={`truncate text-[11px] ${
                  isActive ? 'font-semibold' : 'font-medium'
                }`}
              >
                {step.label}
              </span>
              {count != null && count > 0 ? (
                <span
                  className={`shrink-0 tabular-nums text-[9px] ${
                    isActive ? 'text-accent/80' : 'text-fog/35'
                  }`}
                >
                  {count.toLocaleString('fa-IR')}
                </span>
              ) : null}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
