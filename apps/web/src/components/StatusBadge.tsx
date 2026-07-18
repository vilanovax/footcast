'use client';

const TONE_CLASS = {
  neutral: 'border-fog/20 bg-black/20 text-fog/70',
  warn: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  ok: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  danger: 'border-red-400/35 bg-red-400/10 text-red-200',
  accent: 'border-accent/40 bg-accent/15 text-accent',
} as const;

export function StatusBadge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: keyof typeof TONE_CLASS;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${TONE_CLASS[tone]}`}
    >
      {label}
    </span>
  );
}
