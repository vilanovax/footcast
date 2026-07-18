export type ThemeId = 'pitch' | 'dark' | 'light';

export const THEME_STORAGE_KEY = 'fn_theme';

export const THEMES: Array<{
  id: ThemeId;
  label: string;
  hint: string;
}> = [
  { id: 'pitch', label: 'سبز زمین', hint: 'تم برند اتاق خبر' },
  { id: 'dark', label: 'تیره', hint: 'پس‌زمینه نزدیک به مشکی' },
  { id: 'light', label: 'روشن', hint: 'برای نور روز' },
];

export function isThemeId(value: unknown): value is ThemeId {
  return value === 'pitch' || value === 'dark' || value === 'light';
}

export function getStoredTheme(): ThemeId {
  if (typeof window === 'undefined') return 'pitch';
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeId(raw) ? raw : 'pitch';
}

export function applyTheme(theme: ThemeId): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark';
  const meta = document.querySelector('meta[name="theme-color"]');
  const color =
    theme === 'light' ? '#eef3f0' : theme === 'dark' ? '#0c0f0e' : '#0B3D2E';
  if (meta) meta.setAttribute('content', color);
}

export function setTheme(theme: ThemeId): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}
