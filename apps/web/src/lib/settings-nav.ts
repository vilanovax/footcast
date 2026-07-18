export type SettingsNavItem = {
  id: string;
  label: string;
  adminOnly?: boolean;
  editorVisible?: boolean;
};

export type SettingsNavGroup = {
  id: string;
  label: string;
  items: SettingsNavItem[];
};

/** Client fallback — mirrors SETTINGS_SECTION_META groups for UX. */
export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    id: 'home',
    label: 'شروع',
    items: [{ id: 'general', label: 'نمای کلی', editorVisible: true }],
  },
  {
    id: 'ai',
    label: 'هوش مصنوعی',
    items: [
      { id: 'providers', label: 'Providerها', adminOnly: true },
      { id: 'pipeline', label: 'Pipeline', adminOnly: true },
      { id: 'prompts', label: 'Promptها', editorVisible: true },
      { id: 'audit', label: 'ممیزی AI', adminOnly: true },
      { id: 'test-center', label: 'Test Center', adminOnly: true },
    ],
  },
  {
    id: 'editorial',
    label: 'سردبیری',
    items: [
      { id: 'editorial', label: 'قواعد', editorVisible: true },
      { id: 'automation', label: 'اتوماسیون', editorVisible: true },
      { id: 'weights', label: 'وزن‌ها', editorVisible: true },
      { id: 'coverage', label: 'پوشش', editorVisible: true },
      { id: 'scheduling', label: 'زمان‌بندی', editorVisible: true },
      { id: 'quality', label: 'کیفیت', editorVisible: true },
    ],
  },
  {
    id: 'ops',
    label: 'عملیات',
    items: [
      { id: 'cost', label: 'هزینه', adminOnly: true },
      { id: 'tts', label: 'TTS', adminOnly: true },
      { id: 'notifications', label: 'اعلان‌ها', editorVisible: true },
      { id: 'publishing', label: 'انتشار', editorVisible: true },
      { id: 'flags', label: 'Flags', adminOnly: true },
      { id: 'safe-mode', label: 'Safe Mode', adminOnly: true },
      { id: 'audit-logs', label: 'Audit Logs', adminOnly: true },
    ],
  },
];

export function filterNavGroups(
  groups: SettingsNavGroup[],
  canWrite: boolean,
): SettingsNavGroup[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        if (canWrite) return true;
        if (item.adminOnly) return false;
        return item.editorVisible !== false;
      }),
    }))
    .filter((g) => g.items.length > 0);
}

export const THEME_PREVIEW: Record<
  string,
  { bg: string; accent: string; label: string }
> = {
  pitch: {
    bg: 'linear-gradient(145deg,#0b3d2e,#1a5c45)',
    accent: '#c6a15b',
    label: 'سبز زمین',
  },
  dark: {
    bg: 'linear-gradient(145deg,#0c0f0e,#1c2420)',
    accent: '#d4b06a',
    label: 'تیره',
  },
  light: {
    bg: 'linear-gradient(145deg,#eef3f0,#c5d5cc)',
    accent: '#9a7430',
    label: 'روشن',
  },
};
