'use client';

import { useEffect } from 'react';
import { applyTheme, getStoredTheme } from '../lib/theme';

/** Applies persisted theme before paint flicker is mostly avoided via inline script in layout. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);

  return <>{children}</>;
}
