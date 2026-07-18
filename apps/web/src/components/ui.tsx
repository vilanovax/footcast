export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mt-12 rounded-2xl border border-dashed border-fog/20 bg-black/10 px-6 py-10 text-center">
      <p className="font-display text-base font-semibold text-fog/90">{title}</p>
      {description ? (
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-fog/55">{description}</p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <li
          key={i}
          className="animate-pulse rounded-xl border border-fog/10 bg-black/15 px-4 py-4"
        >
          <div className="h-4 w-[75%] rounded bg-fog/10" />
          <div className="mt-3 h-3 w-full rounded bg-fog/5" />
          <div className="mt-2 h-3 w-[65%] rounded bg-fog/5" />
        </li>
      ))}
    </ul>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3">
      <div>
        {eyebrow ? (
          <p className="text-[11px] font-medium tracking-wide text-accent">{eyebrow}</p>
        ) : null}
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        {subtitle ? <p className="mt-1 text-xs text-fog/60">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
