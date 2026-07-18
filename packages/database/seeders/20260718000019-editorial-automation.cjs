'use strict';

/** Defaults mirrored from packages/shared/src/editorial-automation.ts */

const automation = {
  version: '1.0.0',
  profileMode: 'ASSISTED',

  autoHighlightImportant: true,
  autoSuggestForRundown: true,
  autoAddToRundown: false,
  autoRemoveLowPriority: false,
  autoReplaceLowerUtilityItem: false,

  importantHighlightMinScore: 72,
  importantHighlightMinCredibility: 60,

  suggestMinScore: 68,
  suggestMinCredibility: 58,

  autoAddMinScore: 85,
  autoAddMinCredibility: 80,

  allowedOfficialStatuses: [
    'OFFICIAL',
    'CONFIRMED',
    'RELIABLE_REPORT',
    'MULTI_SOURCE_REPORT',
  ],
  allowedSourceTypes: [],
  minimumSourceCredibility: 80,
  minimumIndependentSources: 1,
  allowSingleSourceOfficial: true,
  allowRumorAutoAdd: false,
  blockOnConflict: true,

  maxAutoAddedItems: 6,
  maxItemsPerTeam: 3,
  maxItemsPerCompetition: 4,
  maxItemsPerCategory: 5,
  stopAutoAddBeforeDeadlineMinutes: 30,

  requireEditorAckOnAutoAdd: true,

  requireRuleAuditOnAutoAdd: true,
  requireAiAuditOnSensitiveAutoAdd: true,
  aiAuditMinConfidence: 0.62,
};

async function ensureSetting(qi, key, value, description) {
  const [existing] = await qi.sequelize.query(
    `SELECT key FROM app_settings WHERE key = :key LIMIT 1`,
    { replacements: { key }, type: qi.sequelize.QueryTypes.SELECT },
  );
  if (existing) return;
  await qi.bulkInsert('app_settings', [
    {
      key,
      value: JSON.stringify(value),
      description,
      updated_at: new Date(),
    },
  ]);
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await ensureSetting(
      queryInterface,
      'control.editorial.automation',
      automation,
      'Auto editorial selection policy (ADR-007)',
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('app_settings', {
      key: ['control.editorial.automation'],
    });
  },
};
