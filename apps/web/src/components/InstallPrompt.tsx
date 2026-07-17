'use client';

import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem('fn_pwa_dismissed') === '1') return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const onBip = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  if (hidden || !deferred) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-50 mx-auto max-w-lg px-4">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-accent/30 bg-[#0d3428]/95 px-3 py-3 shadow-lg backdrop-blur">
        <div className="text-xs">
          <div className="font-semibold text-accent">نصب اپ</div>
          <div className="text-fog/60">اتاق خبر را روی صفحهٔ اصلی گوشی بگذارید</div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg border border-fog/20 px-2 py-1.5 text-[11px]"
            onClick={() => {
              localStorage.setItem('fn_pwa_dismissed', '1');
              setHidden(true);
            }}
          >
            بعداً
          </button>
          <button
            type="button"
            className="rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-ink"
            onClick={() => {
              void deferred.prompt().then(async () => {
                await deferred.userChoice;
                setHidden(true);
                setDeferred(null);
              });
            }}
          >
            نصب
          </button>
        </div>
      </div>
    </div>
  );
}
