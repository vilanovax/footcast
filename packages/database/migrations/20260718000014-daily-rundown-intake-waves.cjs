'use strict';

async function addIndexSafe(qi, table, fields, options = {}) {
  try {
    await qi.addIndex(table, fields, options);
  } catch (err) {
    if (!/already exists/i.test(String(err?.message ?? err))) throw err;
  }
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name));

    if (!names.includes('intake_waves')) {
      await queryInterface.createTable('intake_waves', {
        id: { type: Sequelize.UUID, primaryKey: true },
        editorial_date: { type: Sequelize.DATEONLY, allowNull: false },
        timezone: {
          type: Sequelize.STRING(64),
          allowNull: false,
          defaultValue: 'Asia/Tehran',
        },
        label: { type: Sequelize.STRING(120), allowNull: false },
        profile: {
          type: Sequelize.STRING(32),
          allowNull: false,
          defaultValue: 'FULL',
        },
        scheduled_at: { type: Sequelize.DATE, allowNull: true },
        started_at: { type: Sequelize.DATE, allowNull: true },
        completed_at: { type: Sequelize.DATE, allowNull: true },
        status: {
          type: Sequelize.STRING(32),
          allowNull: false,
          defaultValue: 'RUNNING',
        },
        sources_checked: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        articles_discovered: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        articles_new: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        exact_duplicates: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        near_duplicates: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        events_created: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        events_updated: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        failed_sources: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        metadata: { type: Sequelize.JSONB, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
    }

    await addIndexSafe(queryInterface, 'intake_waves', ['editorial_date']);
    await addIndexSafe(queryInterface, 'intake_waves', ['status']);
    await addIndexSafe(queryInterface, 'intake_waves', ['editorial_date', 'status']);

    if (!names.includes('wave_event_observations')) {
      await queryInterface.createTable('wave_event_observations', {
        id: { type: Sequelize.UUID, primaryKey: true },
        wave_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'intake_waves', key: 'id' },
          onDelete: 'CASCADE',
        },
        news_event_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'news_events', key: 'id' },
          onDelete: 'CASCADE',
        },
        observation_type: { type: Sequelize.STRING(64), allowNull: false },
        previous_version_id: { type: Sequelize.UUID, allowNull: true },
        current_version_id: { type: Sequelize.UUID, allowNull: true },
        raw_article_ids: { type: Sequelize.JSONB, allowNull: true },
        detected_at: { type: Sequelize.DATE, allowNull: false },
        is_seen_by_editor: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        seen_at: { type: Sequelize.DATE, allowNull: true },
        significance_score: { type: Sequelize.FLOAT, allowNull: true },
        summary: { type: Sequelize.TEXT, allowNull: true },
        metadata: { type: Sequelize.JSONB, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
    }

    await addIndexSafe(queryInterface, 'wave_event_observations', ['wave_id']);
    await addIndexSafe(queryInterface, 'wave_event_observations', ['news_event_id']);
    await addIndexSafe(queryInterface, 'wave_event_observations', [
      'wave_id',
      'is_seen_by_editor',
    ]);
    await addIndexSafe(queryInterface, 'wave_event_observations', [
      'wave_id',
      'observation_type',
    ]);

    if (!names.includes('daily_rundowns')) {
      await queryInterface.createTable('daily_rundowns', {
        id: { type: Sequelize.UUID, primaryKey: true },
        editorial_date: { type: Sequelize.DATEONLY, allowNull: false, unique: true },
        timezone: {
          type: Sequelize.STRING(64),
          allowNull: false,
          defaultValue: 'Asia/Tehran',
        },
        deadline_at: { type: Sequelize.DATE, allowNull: false },
        status: {
          type: Sequelize.STRING(32),
          allowNull: false,
          defaultValue: 'COLLECTING',
        },
        target_duration_seconds: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 600,
        },
        locked_at: { type: Sequelize.DATE, allowNull: true },
        locked_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },
        finalized_at: { type: Sequelize.DATE, allowNull: true },
        reopen_reason: { type: Sequelize.TEXT, allowNull: true },
        metadata: { type: Sequelize.JSONB, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
    }

    if (!names.includes('daily_rundown_items')) {
      await queryInterface.createTable('daily_rundown_items', {
        id: { type: Sequelize.UUID, primaryKey: true },
        rundown_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'daily_rundowns', key: 'id' },
          onDelete: 'CASCADE',
        },
        news_event_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'news_events', key: 'id' },
          onDelete: 'CASCADE',
        },
        status: {
          type: Sequelize.STRING(32),
          allowNull: false,
          defaultValue: 'SHORTLISTED',
        },
        section: {
          type: Sequelize.STRING(32),
          allowNull: false,
          defaultValue: 'MAIN',
        },
        editorial_priority: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 50,
        },
        effective_score: { type: Sequelize.FLOAT, allowNull: true },
        estimated_duration_seconds: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 60,
        },
        position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        added_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },
        added_at: { type: Sequelize.DATE, allowNull: false },
        removed_at: { type: Sequelize.DATE, allowNull: true },
        removal_reason: { type: Sequelize.TEXT, allowNull: true },
        is_lead_story: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        is_pinned: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        editor_note: { type: Sequelize.TEXT, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
    }

    await addIndexSafe(queryInterface, 'daily_rundown_items', ['rundown_id']);
    await addIndexSafe(queryInterface, 'daily_rundown_items', ['news_event_id']);
    await addIndexSafe(queryInterface, 'daily_rundown_items', ['rundown_id', 'status']);
    await addIndexSafe(
      queryInterface,
      'daily_rundown_items',
      ['rundown_id', 'news_event_id'],
      { unique: true },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('daily_rundown_items');
    await queryInterface.dropTable('daily_rundowns');
    await queryInterface.dropTable('wave_event_observations');
    await queryInterface.dropTable('intake_waves');
  },
};
