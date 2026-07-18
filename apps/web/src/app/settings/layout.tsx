import { Suspense } from 'react';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={<div className="p-6 text-sm text-fog/50">…</div>}>{children}</Suspense>;
}
