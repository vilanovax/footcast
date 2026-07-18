import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Database } from '@footcast/database';
import {
  CONTROL_SETTING_KEYS,
  DEFAULT_AI_PROVIDERS,
  DEFAULT_AUDIT_POLICIES,
  DEFAULT_COST_CONTROLS,
  DEFAULT_EDITORIAL_RULES,
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_NOTIFICATIONS,
  DEFAULT_PIPELINE,
  DEFAULT_PUBLISHING,
  DEFAULT_QUALITY,
  DEFAULT_SAFE_MODE,
  DEFAULT_SCHEDULING,
  DEFAULT_TTS,
  SETTINGS_SECTION_META,
  providerSecretKey,
  type AiProviderConfig,
  type SettingsSectionId,
} from '@footcast/shared';
import { Op } from 'sequelize';
import { DATABASE_TOKEN } from '../database/database.tokens.js';
import {
  decryptSecret,
  encryptSecret,
  isEncryptedBlob,
  maskSecretMeta,
} from '../common/secret-crypto.js';

const SECRET_KEYS = new Set(['ai.api_key', 'tts.api_key']);

const PUBLIC_KEYS = [
  'product.name.en',
  'product.name.fa',
  'podcast.target_minutes',
  'ui.theme',
  'ai.provider',
  'ai.base_url',
  'ai.model.extract',
  'ai.model.event',
  'ai.model.editorial',
  'ai.model.judge',
  'ai.cluster_judge_enabled',
  'ai.embedding_provider',
  'ai.audit.log_prompts',
  'ai.audit.retain_days',
  'tts.provider',
] as const;

export type WorkspaceSettings = {
  product: {
    nameEn: string;
    nameFa: string;
    podcastTargetMinutes: { min: number; max: number; default: number };
  };
  ui: { theme: 'pitch' | 'dark' | 'light' };
  ai: {
    provider: string;
    baseUrl: string;
    models: {
      extract: string;
      event: string;
      editorial: string;
      judge: string;
    };
    clusterJudgeEnabled: boolean;
    embeddingProvider: string;
    apiKey: { configured: boolean; last4: string | null; source: 'db' | 'env' | null };
    audit: { logPrompts: boolean; retainDays: number };
  };
  tts: {
    provider: string;
    apiKey: { configured: boolean; last4: string | null; source: 'db' | 'env' | null };
  };
  envHints: {
    aiProviderEnv: string | null;
    clusterJudgeEnv: boolean;
  };
};

@Injectable()
export class SettingsService {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: Database) {}

  async list() {
    const rows = await this.db.models.AppSetting.findAll({
      order: [['key', 'ASC']],
    });
    return rows.map((row) => {
      const json = row.toJSON() as { key: string; value: unknown; description?: string };
      if (SECRET_KEYS.has(json.key)) {
        return {
          key: json.key,
          description: json.description,
          value: maskSecretMeta(json.value),
          secret: true,
        };
      }
      return { ...json, secret: false };
    });
  }

  async update(key: string, value: unknown) {
    if (SECRET_KEYS.has(key)) {
      throw new BadRequestException('Use PATCH /settings/ai for secrets');
    }
    const setting = await this.db.models.AppSetting.findByPk(key);
    if (!setting) {
      throw new NotFoundException('Setting not found');
    }
    await setting.update({ value });
    return setting.toJSON();
  }

  async upsert(key: string, value: unknown, description?: string) {
    const existing = await this.db.models.AppSetting.findByPk(key);
    if (existing) {
      await existing.update({ value });
      return existing.toJSON();
    }
    const created = await this.db.models.AppSetting.create({
      key,
      value,
      description: description ?? key,
    });
    return created.toJSON();
  }

  private async getValue(key: string): Promise<unknown> {
    const row = await this.db.models.AppSetting.findByPk(key);
    return row?.getDataValue('value');
  }

  private asString(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim() ? value : fallback;
  }

  private asBool(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') return value;
    return fallback;
  }

  private asNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  private secretStatus(
    dbValue: unknown,
    envValue: string | undefined,
  ): { configured: boolean; last4: string | null; source: 'db' | 'env' | null } {
    const dbMeta = maskSecretMeta(dbValue);
    if (dbMeta.configured) {
      return { ...dbMeta, source: 'db' };
    }
    if (envValue && envValue.trim()) {
      return {
        configured: true,
        last4: envValue.slice(-4),
        source: 'env',
      };
    }
    return { configured: false, last4: null, source: null };
  }

  async workspace(): Promise<WorkspaceSettings> {
    const map = new Map<string, unknown>();
    const rows = await this.db.models.AppSetting.findAll({
      where: { key: { [Op.in]: [...PUBLIC_KEYS, ...SECRET_KEYS] } },
    });
    for (const row of rows) {
      map.set(row.getDataValue('key'), row.getDataValue('value'));
    }

    const podcastRaw = map.get('podcast.target_minutes');
    const podcast =
      podcastRaw && typeof podcastRaw === 'object'
        ? (podcastRaw as { min?: number; max?: number; default?: number })
        : {};

    const themeRaw = this.asString(map.get('ui.theme'), 'pitch');
    const theme =
      themeRaw === 'dark' || themeRaw === 'light' || themeRaw === 'pitch'
        ? themeRaw
        : 'pitch';

    return {
      product: {
        nameEn: this.asString(map.get('product.name.en'), 'Football Newsroom'),
        nameFa: this.asString(map.get('product.name.fa'), 'اتاق خبر فوتبال'),
        podcastTargetMinutes: {
          min: this.asNumber(podcast.min, 8),
          max: this.asNumber(podcast.max, 12),
          default: this.asNumber(podcast.default, 10),
        },
      },
      ui: { theme },
      ai: {
        provider: this.asString(map.get('ai.provider'), process.env.AI_PROVIDER ?? 'mock'),
        baseUrl: this.asString(
          map.get('ai.base_url'),
          process.env.AI_BASE_URL ?? 'https://api.openai.com/v1',
        ),
        models: {
          extract: this.asString(map.get('ai.model.extract'), process.env.AI_MODEL ?? 'gpt-4o-mini'),
          event: this.asString(map.get('ai.model.event'), 'gpt-4o-mini'),
          editorial: this.asString(map.get('ai.model.editorial'), 'gpt-4o'),
          judge: this.asString(
            map.get('ai.model.judge'),
            process.env.CLUSTER_AI_MODEL ?? 'gpt-4o-mini',
          ),
        },
        clusterJudgeEnabled: this.asBool(
          map.get('ai.cluster_judge_enabled'),
          process.env.CLUSTER_AI_JUDGE_ENABLED === 'true',
        ),
        embeddingProvider: this.asString(
          map.get('ai.embedding_provider'),
          process.env.EMBEDDING_PROVIDER ?? 'mock',
        ),
        apiKey: this.secretStatus(map.get('ai.api_key'), process.env.AI_API_KEY),
        audit: {
          logPrompts: this.asBool(map.get('ai.audit.log_prompts'), true),
          retainDays: this.asNumber(map.get('ai.audit.retain_days'), 30),
        },
      },
      tts: {
        provider: this.asString(map.get('tts.provider'), process.env.TTS_PROVIDER ?? 'mock'),
        apiKey: this.secretStatus(map.get('tts.api_key'), process.env.TTS_API_KEY),
      },
      envHints: {
        aiProviderEnv: process.env.AI_PROVIDER ?? null,
        clusterJudgeEnv: process.env.CLUSTER_AI_JUDGE_ENABLED === 'true',
      },
    };
  }

  async updateProduct(input: {
    nameEn?: string;
    nameFa?: string;
    podcastMin?: number;
    podcastMax?: number;
    podcastDefault?: number;
  }) {
    if (input.nameEn != null) {
      await this.upsert('product.name.en', input.nameEn, 'English product name');
    }
    if (input.nameFa != null) {
      await this.upsert('product.name.fa', input.nameFa, 'Persian product name');
    }
    if (
      input.podcastMin != null ||
      input.podcastMax != null ||
      input.podcastDefault != null
    ) {
      const current = (await this.getValue('podcast.target_minutes')) as {
        min?: number;
        max?: number;
        default?: number;
      } | null;
      await this.upsert(
        'podcast.target_minutes',
        {
          min: input.podcastMin ?? current?.min ?? 8,
          max: input.podcastMax ?? current?.max ?? 12,
          default: input.podcastDefault ?? current?.default ?? 10,
        },
        'Target podcast duration',
      );
    }
    return this.workspace();
  }

  async updateUi(input: { theme?: 'pitch' | 'dark' | 'light' }) {
    if (input.theme) {
      await this.upsert('ui.theme', input.theme, 'UI theme: pitch | dark | light');
    }
    return this.workspace();
  }

  async updateAi(input: {
    provider?: string;
    baseUrl?: string;
    modelExtract?: string;
    modelEvent?: string;
    modelEditorial?: string;
    modelJudge?: string;
    clusterJudgeEnabled?: boolean;
    embeddingProvider?: string;
    apiKey?: string | null;
    clearApiKey?: boolean;
    auditLogPrompts?: boolean;
    auditRetainDays?: number;
    ttsProvider?: string;
    ttsApiKey?: string | null;
    clearTtsApiKey?: boolean;
  }) {
    if (input.provider != null) {
      if (!['mock', 'openai_compatible'].includes(input.provider)) {
        throw new BadRequestException('provider must be mock or openai_compatible');
      }
      await this.upsert('ai.provider', input.provider);
    }
    if (input.baseUrl != null) {
      await this.upsert('ai.base_url', input.baseUrl);
    }
    if (input.modelExtract != null) {
      await this.upsert('ai.model.extract', input.modelExtract);
    }
    if (input.modelEvent != null) {
      await this.upsert('ai.model.event', input.modelEvent);
    }
    if (input.modelEditorial != null) {
      await this.upsert('ai.model.editorial', input.modelEditorial);
    }
    if (input.modelJudge != null) {
      await this.upsert('ai.model.judge', input.modelJudge);
    }
    if (input.clusterJudgeEnabled != null) {
      await this.upsert('ai.cluster_judge_enabled', input.clusterJudgeEnabled);
    }
    if (input.embeddingProvider != null) {
      if (!['mock', 'openai'].includes(input.embeddingProvider)) {
        throw new BadRequestException('embeddingProvider must be mock or openai');
      }
      await this.upsert('ai.embedding_provider', input.embeddingProvider);
    }
    if (input.auditLogPrompts != null) {
      await this.upsert('ai.audit.log_prompts', input.auditLogPrompts);
    }
    if (input.auditRetainDays != null) {
      const days = Math.min(365, Math.max(1, Math.floor(input.auditRetainDays)));
      await this.upsert('ai.audit.retain_days', days);
    }
    if (input.ttsProvider != null) {
      await this.upsert('tts.provider', input.ttsProvider);
    }

    if (input.clearApiKey) {
      await this.db.models.AppSetting.destroy({ where: { key: 'ai.api_key' } });
    } else if (typeof input.apiKey === 'string' && input.apiKey.trim()) {
      await this.upsert(
        'ai.api_key',
        encryptSecret(input.apiKey.trim()),
        'Encrypted AI API key',
      );
    }

    if (input.clearTtsApiKey) {
      await this.db.models.AppSetting.destroy({ where: { key: 'tts.api_key' } });
    } else if (typeof input.ttsApiKey === 'string' && input.ttsApiKey.trim()) {
      await this.upsert(
        'tts.api_key',
        encryptSecret(input.ttsApiKey.trim()),
        'Encrypted TTS API key',
      );
    }

    return this.workspace();
  }

  /** Resolve plaintext AI key for server-side runtime (never expose via HTTP). */
  async resolveAiApiKey(): Promise<string | null> {
    const blob = await this.getValue('ai.api_key');
    if (isEncryptedBlob(blob)) {
      return decryptSecret(blob);
    }
    return process.env.AI_API_KEY?.trim() || null;
  }

  private async readJson<T>(key: string, fallback: T): Promise<T> {
    const value = await this.getValue(key);
    if (value == null) return fallback;
    return value as T;
  }

  private async writeAudit(
    actorUserId: string | null,
    action: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ) {
    await this.db.models.AuditLog.create({
      id: randomUUID(),
      actorUserId,
      action,
      entityType: 'AppSetting',
      entityId,
      before,
      after,
      ip: null,
    });
  }

  async getProvidersMasked(): Promise<AiProviderConfig[]> {
    const list = await this.readJson(
      CONTROL_SETTING_KEYS.providers,
      DEFAULT_AI_PROVIDERS,
    );
    const out: AiProviderConfig[] = [];
    for (const p of list) {
      const secret = await this.getValue(providerSecretKey(p.id));
      const meta = maskSecretMeta(secret);
      out.push({
        ...p,
        apiKeyConfigured: meta.configured,
        apiKeyLast4: meta.last4,
      });
    }
    return out;
  }

  async controlCenter() {
    const [
      providers,
      pipeline,
      auditPolicies,
      editorialRules,
      scheduling,
      cost,
      quality,
      tts,
      notifications,
      publishing,
      featureFlags,
      safeMode,
      promptCount,
      recentAudits,
    ] = await Promise.all([
      this.getProvidersMasked(),
      this.readJson(CONTROL_SETTING_KEYS.pipeline, DEFAULT_PIPELINE),
      this.readJson(CONTROL_SETTING_KEYS.auditPolicies, DEFAULT_AUDIT_POLICIES),
      this.readJson(CONTROL_SETTING_KEYS.editorialRules, DEFAULT_EDITORIAL_RULES),
      this.readJson(CONTROL_SETTING_KEYS.scheduling, DEFAULT_SCHEDULING),
      this.readJson(CONTROL_SETTING_KEYS.cost, DEFAULT_COST_CONTROLS),
      this.readJson(CONTROL_SETTING_KEYS.quality, DEFAULT_QUALITY),
      this.readJson(CONTROL_SETTING_KEYS.tts, DEFAULT_TTS),
      this.readJson(CONTROL_SETTING_KEYS.notifications, DEFAULT_NOTIFICATIONS),
      this.readJson(CONTROL_SETTING_KEYS.publishing, DEFAULT_PUBLISHING),
      this.readJson(CONTROL_SETTING_KEYS.featureFlags, DEFAULT_FEATURE_FLAGS),
      this.readJson(CONTROL_SETTING_KEYS.safeMode, DEFAULT_SAFE_MODE),
      this.db.models.PromptVersion.count(),
      this.db.models.AuditLog.findAll({
        order: [['createdAt', 'DESC']],
        limit: 30,
      }),
    ]);

    return {
      sections: SETTINGS_SECTION_META,
      providers,
      pipeline,
      auditPolicies,
      editorialRules,
      scheduling,
      cost,
      quality,
      tts,
      notifications,
      publishing,
      featureFlags,
      safeMode,
      prompts: {
        versionCount: promptCount,
        note: 'نسخه‌های Prompt از جدول prompt_versions؛ ویرایش کامل در فاز بعد',
      },
      auditLogs: recentAudits.map((r) => r.toJSON()),
    };
  }

  async patchControlSection(
    section: SettingsSectionId,
    body: unknown,
    actorUserId: string | null,
  ) {
    const map: Partial<Record<SettingsSectionId, string>> = {
      providers: CONTROL_SETTING_KEYS.providers,
      pipeline: CONTROL_SETTING_KEYS.pipeline,
      audit: CONTROL_SETTING_KEYS.auditPolicies,
      editorial: CONTROL_SETTING_KEYS.editorialRules,
      scheduling: CONTROL_SETTING_KEYS.scheduling,
      cost: CONTROL_SETTING_KEYS.cost,
      quality: CONTROL_SETTING_KEYS.quality,
      tts: CONTROL_SETTING_KEYS.tts,
      notifications: CONTROL_SETTING_KEYS.notifications,
      publishing: CONTROL_SETTING_KEYS.publishing,
      flags: CONTROL_SETTING_KEYS.featureFlags,
      'safe-mode': CONTROL_SETTING_KEYS.safeMode,
    };

    const key = map[section];
    if (!key) {
      throw new BadRequestException(
        `Section "${section}" is not patchable here (use dedicated endpoints)`,
      );
    }

    if (section === 'providers') {
      if (!Array.isArray(body)) {
        throw new BadRequestException('providers must be an array');
      }
      const cleaned = (body as AiProviderConfig[]).map((p) => {
        const {
          apiKeyConfigured: _c,
          apiKeyLast4: _l,
          ...rest
        } = p;
        return rest;
      });
      const before = await this.getValue(key);
      await this.upsert(key, cleaned, 'AI provider registry');
      await this.writeAudit(actorUserId, 'settings.providers.update', key, before, cleaned);
      return this.controlCenter();
    }

    const before = await this.getValue(key);
    await this.upsert(key, body, key);
    await this.writeAudit(actorUserId, `settings.${section}.update`, key, before, body);
    return this.controlCenter();
  }

  async setProviderKey(
    providerId: string,
    apiKey: string | null,
    clear: boolean,
    actorUserId: string | null,
  ) {
    const providers = await this.readJson(
      CONTROL_SETTING_KEYS.providers,
      DEFAULT_AI_PROVIDERS,
    );
    if (!providers.some((p) => p.id === providerId)) {
      throw new NotFoundException('Provider not found');
    }
    const key = providerSecretKey(providerId);
    const before = maskSecretMeta(await this.getValue(key));
    if (clear || apiKey == null || !apiKey.trim()) {
      await this.db.models.AppSetting.destroy({ where: { key } });
      await this.writeAudit(actorUserId, 'settings.provider_key.clear', key, before, {
        configured: false,
      });
    } else {
      const blob = encryptSecret(apiKey.trim());
      await this.upsert(key, blob, `Encrypted key for ${providerId}`);
      await this.writeAudit(actorUserId, 'settings.provider_key.set', key, before, {
        configured: true,
        last4: blob.last4,
      });
    }
    return this.getProvidersMasked();
  }

  async testProvider(providerId: string, actorUserId: string | null) {
    const providers = await this.readJson(
      CONTROL_SETTING_KEYS.providers,
      DEFAULT_AI_PROVIDERS,
    );
    const idx = providers.findIndex((p) => p.id === providerId);
    if (idx < 0) throw new NotFoundException('Provider not found');

    const provider = providers[idx]!;
    const secret = await this.getValue(providerSecretKey(providerId));
    const hasKey = maskSecretMeta(secret).configured || provider.id === 'mock';
    const started = Date.now();

    // v1: connectivity probe without calling paid APIs with user keys in-repo.
    // mock always succeeds; others succeed if key+baseUrl present (format check).
    let ok = false;
    let message = '';
    if (provider.id === 'mock' || provider.baseUrl === 'mock://local') {
      ok = true;
      message = 'Mock provider online';
    } else if (!provider.baseUrl) {
      ok = false;
      message = 'Base URL خالی است';
    } else if (!hasKey) {
      ok = false;
      message = 'API Key تنظیم نشده';
    } else {
      ok = true;
      message = 'پیکربندی کامل است (تست زندهٔ شبکه در فاز بعد)';
    }

    const latencyMs = Date.now() - started + (ok ? 40 : 0);
    const next = [...providers];
    next[idx] = {
      ...provider,
      lastTestAt: new Date().toISOString(),
      lastTestOk: ok,
      lastLatencyMs: latencyMs,
    };
    await this.upsert(CONTROL_SETTING_KEYS.providers, next, 'AI provider registry');
    await this.writeAudit(
      actorUserId,
      'settings.provider_test',
      providerId,
      { lastTestOk: provider.lastTestOk },
      { ok, latencyMs, message },
    );

    const masked = await this.getProvidersMasked();
    return {
      ok,
      message,
      latencyMs,
      provider: masked.find((p) => p.id === providerId) ?? null,
    };
  }
}
