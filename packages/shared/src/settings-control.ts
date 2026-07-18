/** Settings Control Center — typed config stored in AppSetting JSON blobs. */

export type SettingsSectionId =
  | 'general'
  | 'providers'
  | 'pipeline'
  | 'prompts'
  | 'audit'
  | 'editorial'
  | 'weights'
  | 'coverage'
  | 'scheduling'
  | 'cost'
  | 'quality'
  | 'tts'
  | 'notifications'
  | 'publishing'
  | 'flags'
  | 'safe-mode'
  | 'audit-logs'
  | 'test-center';

export type AiProviderKind =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'deepseek'
  | 'z_ai'
  | 'openrouter'
  | 'openai_compatible'
  | 'local';

export type PipelineStageId =
  | 'ARTICLE_EXTRACT'
  | 'CLASSIFY'
  | 'CLUSTER_BOUNDARY'
  | 'EVENT_VALIDATE'
  | 'EDITORIAL_FINAL'
  | 'PODCAST_AUDIT'
  | 'EMBEDDING'
  | 'TTS';

export type AuditStageId =
  | 'EXTRACTION'
  | 'CLUSTERING'
  | 'SCORING'
  | 'RUNDOWN'
  | 'PODCAST_SCRIPT';

export type AuditMode = 'OFF' | 'SAMPLE' | 'ALL';

export type AiProviderConfig = {
  id: string;
  kind: AiProviderKind;
  name: string;
  baseUrl: string;
  enabled: boolean;
  timeoutMs: number;
  retryCount: number;
  rateLimitPerMinute: number;
  dailyBudgetUsd: number | null;
  monthlyBudgetUsd: number | null;
  defaultModel: string;
  /** Never returned plaintext — only status from API. */
  apiKeyConfigured?: boolean;
  apiKeyLast4?: string | null;
  lastTestAt?: string | null;
  lastTestOk?: boolean | null;
  lastLatencyMs?: number | null;
};

export type PipelineStageConfig = {
  stage: PipelineStageId;
  label: string;
  primaryModel: string;
  fallbackModel: string;
  providerId: string;
  fallbackProviderId: string;
  temperature: number;
  maxTokens: number;
  effort: 'low' | 'medium' | 'high';
  timeoutMs: number;
  retryCount: number;
  useCache: boolean;
  useBatch: boolean;
  enabled: boolean;
};

export type AuditPolicy = {
  stage: AuditStageId;
  label: string;
  enabled: boolean;
  mode: AuditMode;
  sampleRate: number;
  minimumScore: number | null;
  minimumCredibility: number | null;
  triggerOnConflict: boolean;
  triggerOnRumor: boolean;
  triggerOnManualOverride: boolean;
  auditorProviderId: string;
  auditorModel: string;
  /** When true, stage cannot proceed / publish until audit passes. */
  blocking: boolean;
};

export type EditorialRulesConfig = {
  inboxMinScore: number;
  minCredibility: number;
  maxItemsPerTeam: number;
  maxTransferItems: number;
  iranShareTarget: number;
  europeShareTarget: number;
  minActiveTrackedCoverage: number;
  rumorPolicy: 'exclude' | 'flag' | 'allow_low_weight';
  singleSourceOfficialPolicy: 'allow' | 'penalize' | 'require_confirm';
  conflictPolicy: 'hold' | 'flag' | 'exclude';
  leadStoryThreshold: number;
  briefThreshold: number;
  durationLeadSec: number;
  durationStandardSec: number;
  durationBriefSec: number;
};

export type CostControlsConfig = {
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  perEpisodeBudgetUsd: number;
  warnAtPercent: number;
  disableExpensiveAtPercent: number;
  expensiveModelTags: string[];
  fallbackModel: string;
  preferBatch: boolean;
  preferPromptCache: boolean;
};

export type QualityThresholdsConfig = {
  minExtractionConfidence: number;
  minClusteringConfidence: number;
  maxAcceptableFalseMergeRate: number;
  minCredibility: number;
  minAuditScore: number;
  maxConflicts: number;
  minIndependentSources: number;
  maxScoreOverrideWithoutAdmin: number;
};

export type SchedulingWave = {
  id: string;
  timeLocal: string;
  kind: 'full' | 'standard' | 'high_priority' | 'official_only' | 'lock';
  label: string;
  enabled: boolean;
};

export type SchedulingConfig = {
  timezone: string;
  lockHour: number;
  lockMinute: number;
  waves: SchedulingWave[];
};

export type FeatureFlagsConfig = {
  enableAiBoundaryJudge: boolean;
  enableOpusEditor: boolean;
  enableAutoCoverageSuggestions: boolean;
  enableScriptAudit: boolean;
  enableTrackedEventBoost: boolean;
  enableSafeMode: boolean;
};

export type SafeModeConfig = {
  enabled: boolean;
  disableExpensiveModels: boolean;
  disableAiMerge: boolean;
  requireFullHumanPublish: boolean;
  reason: string;
};

export type TtsSettingsConfig = {
  providerId: string;
  voice: string;
  speed: number;
  pitch: number;
  outputFormat: string;
  bitrateKbps: number;
  pauseBetweenSectionsMs: number;
  normalizeAudio: boolean;
  pronunciation: Array<{ from: string; to: string }>;
};

export type NotificationChannel = 'in_app' | 'telegram' | 'email' | 'push';

export type NotificationsConfig = {
  channels: NotificationChannel[];
  crawlerError: boolean;
  aiError: boolean;
  highCost: boolean;
  sourceInactive: boolean;
  coverageGap: boolean;
  seriousConflict: boolean;
  nearLockDeadline: boolean;
  incompleteRundown: boolean;
  scriptReady: boolean;
  auditFailed: boolean;
  audioFailed: boolean;
};

export type PublishingConfig = {
  channels: Array<'rss' | 'telegram' | 'web' | 'app' | 'social'>;
  autoPublish: boolean;
  titleFormat: string;
  includeCover: boolean;
  includeAudio: boolean;
};

export const SETTINGS_SECTION_META: Array<{
  id: SettingsSectionId;
  label: string;
  hint: string;
  adminOnly?: boolean;
  editorVisible?: boolean;
}> = [
  { id: 'general', label: 'عمومی', hint: 'نام محصول، تم، مدت پادکست', editorVisible: true },
  { id: 'providers', label: 'مدل‌ها و Providerها', hint: 'کلید، سقف هزینه، تست اتصال', adminOnly: true },
  { id: 'pipeline', label: 'تخصیص Pipeline', hint: 'مدل هر مرحله + fallback', adminOnly: true },
  { id: 'prompts', label: 'Promptها', hint: 'نسخه‌بندی و قالب‌ها', editorVisible: true },
  { id: 'audit', label: 'ممیزی هوش مصنوعی', hint: 'سیاست OFF/SAMPLE/ALL', adminOnly: true },
  { id: 'editorial', label: 'قواعد سردبیری', hint: 'آستانه‌ها و سهم پوشش', editorVisible: true },
  { id: 'weights', label: 'وزن تیم/لیگ', hint: 'اولویت تحریریه', editorVisible: true },
  { id: 'coverage', label: 'اهداف پوشش', hint: 'لینک به Coverage Intelligence', editorVisible: true },
  { id: 'scheduling', label: 'زمان‌بندی موج‌ها', hint: 'موج‌ها و قفل ۱۶:۰۰', editorVisible: true },
  { id: 'cost', label: 'هزینه و بودجه', hint: 'سقف روزانه/ماهانه', adminOnly: true },
  { id: 'quality', label: 'آستانه‌های کیفیت', hint: 'اعتماد extraction/cluster', editorVisible: true },
  { id: 'tts', label: 'TTS و تلفظ', hint: 'صوت و واژه‌نامه', adminOnly: true },
  { id: 'notifications', label: 'اعلان‌ها', hint: 'کانال و رویدادها', editorVisible: true },
  { id: 'publishing', label: 'انتشار', hint: 'کانال‌ها و خودکار/دستی', editorVisible: true },
  { id: 'flags', label: 'Feature Flags', hint: 'کلیدهای قابلیت', adminOnly: true },
  { id: 'safe-mode', label: 'Safe Mode', hint: 'کاهش ریسک هزینه/AI', adminOnly: true },
  { id: 'audit-logs', label: 'Audit Logs', hint: 'تغییرات انسانی و سیستمی', adminOnly: true },
  { id: 'test-center', label: 'Test Center', hint: 'تست Provider و Prompt', adminOnly: true },
];

export const DEFAULT_AI_PROVIDERS: AiProviderConfig[] = [
  {
    id: 'openai',
    kind: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    enabled: false,
    timeoutMs: 60_000,
    retryCount: 2,
    rateLimitPerMinute: 60,
    dailyBudgetUsd: 20,
    monthlyBudgetUsd: 300,
    defaultModel: 'gpt-4o-mini',
  },
  {
    id: 'anthropic',
    kind: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    enabled: false,
    timeoutMs: 60_000,
    retryCount: 2,
    rateLimitPerMinute: 40,
    dailyBudgetUsd: 25,
    monthlyBudgetUsd: 400,
    defaultModel: 'claude-haiku-4-5',
  },
  {
    id: 'google',
    kind: 'google',
    name: 'Google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    enabled: false,
    timeoutMs: 60_000,
    retryCount: 2,
    rateLimitPerMinute: 60,
    dailyBudgetUsd: 15,
    monthlyBudgetUsd: 200,
    defaultModel: 'gemini-2.0-flash',
  },
  {
    id: 'deepseek',
    kind: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    enabled: false,
    timeoutMs: 60_000,
    retryCount: 2,
    rateLimitPerMinute: 60,
    dailyBudgetUsd: 10,
    monthlyBudgetUsd: 150,
    defaultModel: 'deepseek-chat',
  },
  {
    id: 'openrouter',
    kind: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    enabled: false,
    timeoutMs: 90_000,
    retryCount: 2,
    rateLimitPerMinute: 40,
    dailyBudgetUsd: 20,
    monthlyBudgetUsd: 300,
    defaultModel: 'openai/gpt-4o-mini',
  },
  {
    id: 'z_ai',
    kind: 'z_ai',
    name: 'Z.ai',
    baseUrl: '',
    enabled: false,
    timeoutMs: 60_000,
    retryCount: 2,
    rateLimitPerMinute: 30,
    dailyBudgetUsd: 10,
    monthlyBudgetUsd: 100,
    defaultModel: '',
  },
  {
    id: 'custom',
    kind: 'openai_compatible',
    name: 'Custom OpenAI-Compatible',
    baseUrl: '',
    enabled: false,
    timeoutMs: 60_000,
    retryCount: 2,
    rateLimitPerMinute: 30,
    dailyBudgetUsd: null,
    monthlyBudgetUsd: null,
    defaultModel: '',
  },
  {
    id: 'local',
    kind: 'local',
    name: 'Local Model',
    baseUrl: 'http://127.0.0.1:11434/v1',
    enabled: false,
    timeoutMs: 120_000,
    retryCount: 1,
    rateLimitPerMinute: 0,
    dailyBudgetUsd: null,
    monthlyBudgetUsd: null,
    defaultModel: 'local-model',
  },
  {
    id: 'mock',
    kind: 'openai_compatible',
    name: 'Mock (dev)',
    baseUrl: 'mock://local',
    enabled: true,
    timeoutMs: 5_000,
    retryCount: 0,
    rateLimitPerMinute: 0,
    dailyBudgetUsd: null,
    monthlyBudgetUsd: null,
    defaultModel: 'mock',
  },
];

export const DEFAULT_PIPELINE: PipelineStageConfig[] = [
  {
    stage: 'ARTICLE_EXTRACT',
    label: 'استخراج مقاله',
    primaryModel: 'claude-haiku-4-5',
    fallbackModel: 'gemini-2.0-flash',
    providerId: 'anthropic',
    fallbackProviderId: 'google',
    temperature: 0.2,
    maxTokens: 2048,
    effort: 'low',
    timeoutMs: 45_000,
    retryCount: 2,
    useCache: true,
    useBatch: false,
    enabled: true,
  },
  {
    stage: 'CLASSIFY',
    label: 'دسته‌بندی',
    primaryModel: 'claude-haiku-4-5',
    fallbackModel: 'gpt-4o-mini',
    providerId: 'anthropic',
    fallbackProviderId: 'openai',
    temperature: 0.1,
    maxTokens: 1024,
    effort: 'low',
    timeoutMs: 30_000,
    retryCount: 2,
    useCache: true,
    useBatch: true,
    enabled: true,
  },
  {
    stage: 'CLUSTER_BOUNDARY',
    label: 'تشخیص تکراری مرزی',
    primaryModel: 'claude-haiku-4-5',
    fallbackModel: 'claude-sonnet-4-5',
    providerId: 'anthropic',
    fallbackProviderId: 'anthropic',
    temperature: 0.1,
    maxTokens: 1024,
    effort: 'medium',
    timeoutMs: 45_000,
    retryCount: 1,
    useCache: false,
    useBatch: false,
    enabled: true,
  },
  {
    stage: 'EVENT_VALIDATE',
    label: 'اعتبارسنجی رویداد',
    primaryModel: 'claude-sonnet-4-5',
    fallbackModel: 'gpt-4o',
    providerId: 'anthropic',
    fallbackProviderId: 'openai',
    temperature: 0.2,
    maxTokens: 2048,
    effort: 'medium',
    timeoutMs: 60_000,
    retryCount: 2,
    useCache: false,
    useBatch: false,
    enabled: true,
  },
  {
    stage: 'EDITORIAL_FINAL',
    label: 'سردبیری نهایی',
    primaryModel: 'claude-opus-4-6',
    fallbackModel: 'claude-sonnet-4-5',
    providerId: 'anthropic',
    fallbackProviderId: 'anthropic',
    temperature: 0.4,
    maxTokens: 4096,
    effort: 'high',
    timeoutMs: 120_000,
    retryCount: 1,
    useCache: false,
    useBatch: false,
    enabled: true,
  },
  {
    stage: 'PODCAST_AUDIT',
    label: 'ممیزی متن پادکست',
    primaryModel: 'claude-sonnet-4-5',
    fallbackModel: 'gpt-4o',
    providerId: 'anthropic',
    fallbackProviderId: 'openai',
    temperature: 0.1,
    maxTokens: 3072,
    effort: 'medium',
    timeoutMs: 90_000,
    retryCount: 1,
    useCache: false,
    useBatch: false,
    enabled: true,
  },
  {
    stage: 'EMBEDDING',
    label: 'تولید embedding',
    primaryModel: 'text-embedding-3-small',
    fallbackModel: 'text-embedding-3-small',
    providerId: 'openai',
    fallbackProviderId: 'openai',
    temperature: 0,
    maxTokens: 0,
    effort: 'low',
    timeoutMs: 30_000,
    retryCount: 2,
    useCache: true,
    useBatch: true,
    enabled: true,
  },
  {
    stage: 'TTS',
    label: 'TTS',
    primaryModel: 'eleven_multilingual_v2',
    fallbackModel: 'mock',
    providerId: 'custom',
    fallbackProviderId: 'mock',
    temperature: 0,
    maxTokens: 0,
    effort: 'low',
    timeoutMs: 180_000,
    retryCount: 1,
    useCache: false,
    useBatch: false,
    enabled: true,
  },
];

export const DEFAULT_AUDIT_POLICIES: AuditPolicy[] = [
  {
    stage: 'EXTRACTION',
    label: 'ممیزی خبر استخراج‌شده',
    enabled: true,
    mode: 'SAMPLE',
    sampleRate: 0.1,
    minimumScore: null,
    minimumCredibility: null,
    triggerOnConflict: true,
    triggerOnRumor: true,
    triggerOnManualOverride: false,
    auditorProviderId: 'anthropic',
    auditorModel: 'claude-sonnet-4-5',
    blocking: false,
  },
  {
    stage: 'CLUSTERING',
    label: 'ممیزی خوشه‌بندی',
    enabled: true,
    mode: 'SAMPLE',
    sampleRate: 0.15,
    minimumScore: null,
    minimumCredibility: null,
    triggerOnConflict: true,
    triggerOnRumor: false,
    triggerOnManualOverride: true,
    auditorProviderId: 'anthropic',
    auditorModel: 'claude-sonnet-4-5',
    blocking: false,
  },
  {
    stage: 'SCORING',
    label: 'ممیزی امتیاز',
    enabled: true,
    mode: 'SAMPLE',
    sampleRate: 0.1,
    minimumScore: 70,
    minimumCredibility: 60,
    triggerOnConflict: true,
    triggerOnRumor: true,
    triggerOnManualOverride: true,
    auditorProviderId: 'anthropic',
    auditorModel: 'claude-sonnet-4-5',
    blocking: false,
  },
  {
    stage: 'RUNDOWN',
    label: 'ممیزی سبد Today',
    enabled: true,
    mode: 'ALL',
    sampleRate: 1,
    minimumScore: null,
    minimumCredibility: 50,
    triggerOnConflict: true,
    triggerOnRumor: true,
    triggerOnManualOverride: false,
    auditorProviderId: 'anthropic',
    auditorModel: 'claude-sonnet-4-5',
    blocking: false,
  },
  {
    stage: 'PODCAST_SCRIPT',
    label: 'ممیزی متن پادکست',
    enabled: true,
    mode: 'ALL',
    sampleRate: 1,
    minimumScore: null,
    minimumCredibility: null,
    triggerOnConflict: true,
    triggerOnRumor: true,
    triggerOnManualOverride: true,
    auditorProviderId: 'anthropic',
    auditorModel: 'claude-sonnet-4-5',
    blocking: true,
  },
];

export const DEFAULT_EDITORIAL_RULES: EditorialRulesConfig = {
  inboxMinScore: 55,
  minCredibility: 50,
  maxItemsPerTeam: 3,
  maxTransferItems: 4,
  iranShareTarget: 0.55,
  europeShareTarget: 0.45,
  minActiveTrackedCoverage: 1,
  rumorPolicy: 'flag',
  singleSourceOfficialPolicy: 'allow',
  conflictPolicy: 'hold',
  leadStoryThreshold: 80,
  briefThreshold: 55,
  durationLeadSec: 120,
  durationStandardSec: 75,
  durationBriefSec: 40,
};

export const DEFAULT_COST_CONTROLS: CostControlsConfig = {
  dailyBudgetUsd: 25,
  monthlyBudgetUsd: 400,
  perEpisodeBudgetUsd: 3,
  warnAtPercent: 70,
  disableExpensiveAtPercent: 90,
  expensiveModelTags: ['opus', 'gpt-4o', 'sonnet'],
  fallbackModel: 'claude-haiku-4-5',
  preferBatch: true,
  preferPromptCache: true,
};

export const DEFAULT_QUALITY: QualityThresholdsConfig = {
  minExtractionConfidence: 0.7,
  minClusteringConfidence: 0.75,
  maxAcceptableFalseMergeRate: 0.05,
  minCredibility: 50,
  minAuditScore: 0.7,
  maxConflicts: 2,
  minIndependentSources: 1,
  maxScoreOverrideWithoutAdmin: 15,
};

export const DEFAULT_SCHEDULING: SchedulingConfig = {
  timezone: 'Asia/Tehran',
  lockHour: 16,
  lockMinute: 0,
  waves: [
    { id: 'w0630', timeLocal: '06:30', kind: 'full', label: 'موج کامل صبح', enabled: true },
    { id: 'w0900', timeLocal: '09:00', kind: 'full', label: 'موج کامل', enabled: true },
    { id: 'w1130', timeLocal: '11:30', kind: 'standard', label: 'موج استاندارد', enabled: true },
    { id: 'w1330', timeLocal: '13:30', kind: 'full', label: 'موج کامل ظهر', enabled: true },
    { id: 'w1500', timeLocal: '15:00', kind: 'high_priority', label: 'اولویت بالا', enabled: true },
    {
      id: 'w1530',
      timeLocal: '15:30',
      kind: 'official_only',
      label: 'فقط منابع رسمی',
      enabled: true,
    },
    { id: 'w1600', timeLocal: '16:00', kind: 'lock', label: 'قفل Today', enabled: true },
  ],
};

export const DEFAULT_FEATURE_FLAGS: FeatureFlagsConfig = {
  enableAiBoundaryJudge: false,
  enableOpusEditor: false,
  enableAutoCoverageSuggestions: true,
  enableScriptAudit: true,
  enableTrackedEventBoost: true,
  enableSafeMode: false,
};

export const DEFAULT_SAFE_MODE: SafeModeConfig = {
  enabled: false,
  disableExpensiveModels: true,
  disableAiMerge: true,
  requireFullHumanPublish: true,
  reason: '',
};

export const DEFAULT_TTS: TtsSettingsConfig = {
  providerId: 'mock',
  voice: 'fa-IR-default',
  speed: 1,
  pitch: 0,
  outputFormat: 'mp3',
  bitrateKbps: 128,
  pauseBetweenSectionsMs: 400,
  normalizeAudio: true,
  pronunciation: [
    { from: 'De Bruyne', to: 'دِ بروینه' },
    { from: 'Guardiola', to: 'گواردیولا' },
  ],
};

export const DEFAULT_NOTIFICATIONS: NotificationsConfig = {
  channels: ['in_app'],
  crawlerError: true,
  aiError: true,
  highCost: true,
  sourceInactive: true,
  coverageGap: true,
  seriousConflict: true,
  nearLockDeadline: true,
  incompleteRundown: true,
  scriptReady: true,
  auditFailed: true,
  audioFailed: true,
};

export const DEFAULT_PUBLISHING: PublishingConfig = {
  channels: ['web', 'app'],
  autoPublish: false,
  titleFormat: '{date} — اتاق خبر فوتبال',
  includeCover: true,
  includeAudio: true,
};

export const CONTROL_SETTING_KEYS = {
  providers: 'control.ai.providers',
  pipeline: 'control.ai.pipeline',
  auditPolicies: 'control.ai.audit_policies',
  editorialRules: 'control.editorial.rules',
  scheduling: 'control.scheduling',
  cost: 'control.cost',
  quality: 'control.quality',
  tts: 'control.tts',
  notifications: 'control.notifications',
  publishing: 'control.publishing',
  featureFlags: 'control.feature_flags',
  safeMode: 'control.safe_mode',
} as const;

export function providerSecretKey(providerId: string): string {
  return `control.ai.provider.${providerId}.api_key`;
}
