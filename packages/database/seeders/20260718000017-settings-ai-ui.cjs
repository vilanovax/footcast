'use strict';

async function ensureSetting(qi, row) {
  const [existing] = await qi.sequelize.query(
    `SELECT key FROM app_settings WHERE key = :key LIMIT 1`,
    {
      replacements: { key: row.key },
      type: qi.sequelize.QueryTypes.SELECT,
    },
  );
  if (existing) return;
  await qi.bulkInsert('app_settings', [row]);
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const rows = [
      {
        key: 'ui.theme',
        value: JSON.stringify('pitch'),
        description: 'UI theme: pitch | dark | light',
        updated_at: now,
      },
      {
        key: 'ai.provider',
        value: JSON.stringify('mock'),
        description: 'AI provider: mock | openai_compatible',
        updated_at: now,
      },
      {
        key: 'ai.base_url',
        value: JSON.stringify('https://api.openai.com/v1'),
        description: 'OpenAI-compatible base URL',
        updated_at: now,
      },
      {
        key: 'ai.model.extract',
        value: JSON.stringify('gpt-4o-mini'),
        description: 'Cheap model for article extraction',
        updated_at: now,
      },
      {
        key: 'ai.model.event',
        value: JSON.stringify('gpt-4o-mini'),
        description: 'Mid model for event clustering / cards',
        updated_at: now,
      },
      {
        key: 'ai.model.editorial',
        value: JSON.stringify('gpt-4o'),
        description: 'Stronger model for editorial / podcast script',
        updated_at: now,
      },
      {
        key: 'ai.model.judge',
        value: JSON.stringify('gpt-4o-mini'),
        description: 'Model for cluster AI boundary judge',
        updated_at: now,
      },
      {
        key: 'ai.cluster_judge_enabled',
        value: JSON.stringify(false),
        description: 'Enable AI judge in clustering score band',
        updated_at: now,
      },
      {
        key: 'ai.embedding_provider',
        value: JSON.stringify('mock'),
        description: 'Embedding provider: mock | openai',
        updated_at: now,
      },
      {
        key: 'ai.audit.log_prompts',
        value: JSON.stringify(true),
        description: 'Keep prompt/response metadata for AI audit',
        updated_at: now,
      },
      {
        key: 'ai.audit.retain_days',
        value: JSON.stringify(30),
        description: 'Days to retain AI request audit rows',
        updated_at: now,
      },
      {
        key: 'tts.provider',
        value: JSON.stringify('mock'),
        description: 'TTS provider: mock | elevenlabs',
        updated_at: now,
      },
    ];

    for (const row of rows) {
      await ensureSetting(queryInterface, row);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('app_settings', {
      key: [
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
        'ai.api_key',
        'tts.api_key',
      ],
    });
  },
};
