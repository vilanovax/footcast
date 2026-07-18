'use strict';

async function addColumnIfMissing(qi, table, column, spec) {
  const desc = await qi.describeTable(table);
  if (!desc[column]) await qi.addColumn(table, column, spec);
}

async function addIndexSafe(qi, table, fields) {
  try {
    await qi.addIndex(table, fields);
  } catch (err) {
    if (!/already exists/i.test(String(err?.message ?? err))) throw err;
  }
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfMissing(queryInterface, 'news_events', 'merged_into_event_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'news_events', key: 'id' },
      onDelete: 'SET NULL',
    });

    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name));

    if (!names.includes('cluster_decision_logs')) {
      await queryInterface.createTable('cluster_decision_logs', {
        id: { type: Sequelize.UUID, primaryKey: true },
        raw_article_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'raw_articles', key: 'id' },
          onDelete: 'CASCADE',
        },
        selected_event_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'news_events', key: 'id' },
          onDelete: 'SET NULL',
        },
        decision: { type: Sequelize.STRING(32), allowNull: false },
        relationship: { type: Sequelize.STRING(64), allowNull: true },
        final_similarity: { type: Sequelize.FLOAT, allowNull: true },
        similarity_breakdown: { type: Sequelize.JSONB, allowNull: true },
        candidate_snapshot: { type: Sequelize.JSONB, allowNull: true },
        threshold_policy_version: { type: Sequelize.STRING(32), allowNull: false },
        ai_used: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        ai_provider: { type: Sequelize.STRING(64), allowNull: true },
        ai_model: { type: Sequelize.STRING(64), allowNull: true },
        ai_confidence: { type: Sequelize.FLOAT, allowNull: true },
        reason: { type: Sequelize.TEXT, allowNull: true },
        processing_duration_ms: { type: Sequelize.INTEGER, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
      });
    }

    if (!names.includes('clustering_evaluations')) {
      await queryInterface.createTable('clustering_evaluations', {
        id: { type: Sequelize.UUID, primaryKey: true },
        raw_article_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'raw_articles', key: 'id' },
          onDelete: 'CASCADE',
        },
        predicted_event_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'news_events', key: 'id' },
          onDelete: 'SET NULL',
        },
        predicted_relationship: { type: Sequelize.STRING(64), allowNull: true },
        predicted_score: { type: Sequelize.FLOAT, allowNull: true },
        expected_event_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'news_events', key: 'id' },
          onDelete: 'SET NULL',
        },
        expected_relationship: { type: Sequelize.STRING(64), allowNull: false },
        verdict: { type: Sequelize.STRING(64), allowNull: false },
        reviewer_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },
        note: { type: Sequelize.TEXT, allowNull: true },
        decision_log_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'cluster_decision_logs', key: 'id' },
          onDelete: 'SET NULL',
        },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
    }

    if (!names.includes('entities')) {
      await queryInterface.createTable('entities', {
        id: { type: Sequelize.UUID, primaryKey: true },
        type: { type: Sequelize.STRING(32), allowNull: false },
        canonical_name: { type: Sequelize.STRING(255), allowNull: false },
        normalized_name: { type: Sequelize.STRING(255), allowNull: false },
        external_id: { type: Sequelize.STRING(128), allowNull: true },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
    }

    if (!names.includes('entity_aliases')) {
      await queryInterface.createTable('entity_aliases', {
        id: { type: Sequelize.UUID, primaryKey: true },
        entity_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'entities', key: 'id' },
          onDelete: 'CASCADE',
        },
        alias: { type: Sequelize.STRING(255), allowNull: false },
        normalized_alias: { type: Sequelize.STRING(255), allowNull: false },
        language: { type: Sequelize.STRING(8), allowNull: true },
        source_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'sources', key: 'id' },
          onDelete: 'SET NULL',
        },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
    }

    await addIndexSafe(queryInterface, 'cluster_decision_logs', ['raw_article_id']);
    await addIndexSafe(queryInterface, 'cluster_decision_logs', ['created_at']);
    await addIndexSafe(queryInterface, 'clustering_evaluations', ['raw_article_id']);
    await addIndexSafe(queryInterface, 'clustering_evaluations', ['verdict']);
    await addIndexSafe(queryInterface, 'entities', ['normalized_name']);
    await addIndexSafe(queryInterface, 'entities', ['type']);
    await addIndexSafe(queryInterface, 'entity_aliases', ['normalized_alias']);
    await addIndexSafe(queryInterface, 'entity_aliases', ['entity_id']);
    await addIndexSafe(queryInterface, 'news_events', ['merged_into_event_id']);

    // Seed common Iranian club aliases
    const now = new Date();
    const persepolisId = 'a1000000-0000-4000-8000-000000000001';
    const esteghlalId = 'a1000000-0000-4000-8000-000000000002';
    await queryInterface.sequelize.query(
      `
      INSERT INTO entities (id, type, canonical_name, normalized_name, external_id, is_active, created_at, updated_at)
      VALUES
        (:pid, 'CLUB', 'پرسپولیس', 'پرسپولیس', NULL, true, :now, :now),
        (:eid, 'CLUB', 'استقلال', 'استقلال', NULL, true, :now, :now)
      ON CONFLICT (id) DO NOTHING
      `,
      { replacements: { pid: persepolisId, eid: esteghlalId, now } },
    );

    const aliases = [
      [persepolisId, 'پرسپولیس', 'fa'],
      [persepolisId, 'باشگاه پرسپولیس', 'fa'],
      [persepolisId, 'سرخ‌پوشان', 'fa'],
      [persepolisId, 'سرخپوشان', 'fa'],
      [persepolisId, 'Persepolis', 'en'],
      [persepolisId, 'Persepolis FC', 'en'],
      [esteghlalId, 'استقلال', 'fa'],
      [esteghlalId, 'باشگاه استقلال', 'fa'],
      [esteghlalId, 'آبی‌ها', 'fa'],
      [esteghlalId, 'Esteghlal', 'en'],
      [esteghlalId, 'Esteghlal FC', 'en'],
    ];
    for (const [entityId, alias, language] of aliases) {
      const id = globalThis.crypto?.randomUUID?.() ?? require('crypto').randomUUID();
      const normalized = String(alias)
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u064B-\u065F\u0670]/g, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      await queryInterface.sequelize.query(
        `
        INSERT INTO entity_aliases (id, entity_id, alias, normalized_alias, language, source_id, created_at, updated_at)
        SELECT :id, :entityId, :alias, :normalized, :language, NULL, :now, :now
        WHERE NOT EXISTS (
          SELECT 1 FROM entity_aliases WHERE entity_id = :entityId AND normalized_alias = :normalized
        )
        `,
        { replacements: { id, entityId, alias, normalized, language, now } },
      );
    }
  },

  async down(queryInterface) {
    for (const t of [
      'entity_aliases',
      'entities',
      'clustering_evaluations',
      'cluster_decision_logs',
    ]) {
      const tables = await queryInterface.showAllTables();
      const names = tables.map((x) => (typeof x === 'string' ? x : x.tableName || x.name));
      if (names.includes(t)) await queryInterface.dropTable(t);
    }
    const cols = await queryInterface.describeTable('news_events');
    if (cols.merged_into_event_id) {
      await queryInterface.removeColumn('news_events', 'merged_into_event_id');
    }
  },
};
