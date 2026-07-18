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

    if (!names.includes('editorial_teams')) {
      await queryInterface.createTable('editorial_teams', {
        id: { type: Sequelize.UUID, primaryKey: true },
        slug: { type: Sequelize.STRING(64), allowNull: false, unique: true },
        name_fa: { type: Sequelize.STRING(120), allowNull: false },
        name_en: { type: Sequelize.STRING(120), allowNull: true },
        scope: { type: Sequelize.STRING(32), allowNull: true },
        is_key_team: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        aliases: { type: Sequelize.JSONB, allowNull: true },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
    }

    if (!names.includes('competitions')) {
      await queryInterface.createTable('competitions', {
        id: { type: Sequelize.UUID, primaryKey: true },
        slug: { type: Sequelize.STRING(64), allowNull: false, unique: true },
        name_fa: { type: Sequelize.STRING(120), allowNull: false },
        name_en: { type: Sequelize.STRING(120), allowNull: true },
        kind: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'LEAGUE' },
        region: { type: Sequelize.STRING(32), allowNull: true },
        aliases: { type: Sequelize.JSONB, allowNull: true },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
    }

    if (!names.includes('tracked_events')) {
      await queryInterface.createTable('tracked_events', {
        id: { type: Sequelize.UUID, primaryKey: true },
        slug: { type: Sequelize.STRING(64), allowNull: false, unique: true },
        title: { type: Sequelize.STRING(200), allowNull: false },
        type: { type: Sequelize.STRING(64), allowNull: false },
        competition_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'competitions', key: 'id' },
          onDelete: 'SET NULL',
        },
        starts_at: { type: Sequelize.DATE, allowNull: true },
        ends_at: { type: Sequelize.DATE, allowNull: true },
        priority: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 50 },
        target_news_count: { type: Sequelize.INTEGER, allowNull: true },
        target_duration_seconds: { type: Sequelize.INTEGER, allowNull: true },
        active_boost: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        aliases: { type: Sequelize.JSONB, allowNull: true },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
    }

    if (!names.includes('news_event_teams')) {
      await queryInterface.createTable('news_event_teams', {
        id: { type: Sequelize.UUID, primaryKey: true },
        news_event_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'news_events', key: 'id' },
          onDelete: 'CASCADE',
        },
        team_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'editorial_teams', key: 'id' },
          onDelete: 'CASCADE',
        },
        role: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'PRIMARY' },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
      await addIndexSafe(queryInterface, 'news_event_teams', ['news_event_id', 'team_id'], {
        unique: true,
      });
    }

    if (!names.includes('news_event_competitions')) {
      await queryInterface.createTable('news_event_competitions', {
        id: { type: Sequelize.UUID, primaryKey: true },
        news_event_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'news_events', key: 'id' },
          onDelete: 'CASCADE',
        },
        competition_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'competitions', key: 'id' },
          onDelete: 'CASCADE',
        },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
      await addIndexSafe(
        queryInterface,
        'news_event_competitions',
        ['news_event_id', 'competition_id'],
        { unique: true },
      );
    }

    if (!names.includes('news_event_tracked_events')) {
      await queryInterface.createTable('news_event_tracked_events', {
        id: { type: Sequelize.UUID, primaryKey: true },
        news_event_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'news_events', key: 'id' },
          onDelete: 'CASCADE',
        },
        tracked_event_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'tracked_events', key: 'id' },
          onDelete: 'CASCADE',
        },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
      await addIndexSafe(
        queryInterface,
        'news_event_tracked_events',
        ['news_event_id', 'tracked_event_id'],
        { unique: true },
      );
    }

    if (!names.includes('coverage_targets')) {
      await queryInterface.createTable('coverage_targets', {
        id: { type: Sequelize.UUID, primaryKey: true },
        dimension: { type: Sequelize.STRING(32), allowNull: false },
        key: { type: Sequelize.STRING(64), allowNull: false },
        label: { type: Sequelize.STRING(120), allowNull: true },
        min_selected_count: { type: Sequelize.INTEGER, allowNull: true },
        max_selected_count: { type: Sequelize.INTEGER, allowNull: true },
        min_duration_seconds: { type: Sequelize.INTEGER, allowNull: true },
        max_duration_seconds: { type: Sequelize.INTEGER, allowNull: true },
        priority: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 50 },
        enforcement: {
          type: Sequelize.STRING(16),
          allowNull: false,
          defaultValue: 'SOFT',
        },
        editorial_profile_id: { type: Sequelize.STRING(64), allowNull: true },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
      await addIndexSafe(queryInterface, 'coverage_targets', ['dimension', 'key'], {
        unique: true,
      });
    }

    if (!names.includes('editorial_entity_weights')) {
      await queryInterface.createTable('editorial_entity_weights', {
        id: { type: Sequelize.UUID, primaryKey: true },
        entity_type: { type: Sequelize.STRING(32), allowNull: false },
        entity_id: { type: Sequelize.UUID, allowNull: false },
        entity_key: { type: Sequelize.STRING(64), allowNull: false },
        base_weight: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 50 },
        audience_weight: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 50 },
        event_boost: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        effective_from: { type: Sequelize.DATE, allowNull: true },
        effective_to: { type: Sequelize.DATE, allowNull: true },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
      await addIndexSafe(queryInterface, 'editorial_entity_weights', [
        'entity_type',
        'entity_key',
      ]);
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('editorial_entity_weights');
    await queryInterface.dropTable('coverage_targets');
    await queryInterface.dropTable('news_event_tracked_events');
    await queryInterface.dropTable('news_event_competitions');
    await queryInterface.dropTable('news_event_teams');
    await queryInterface.dropTable('tracked_events');
    await queryInterface.dropTable('competitions');
    await queryInterface.dropTable('editorial_teams');
  },
};
