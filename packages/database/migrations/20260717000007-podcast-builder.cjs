'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('podcast_episodes', {
      id: { type: Sequelize.UUID, primaryKey: true },
      title: { type: Sequelize.STRING(300), allowNull: false },
      slug: { type: Sequelize.STRING(160), allowNull: false, unique: true },
      status: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'DRAFT' },
      language: { type: Sequelize.STRING(8), allowNull: false, defaultValue: 'fa' },
      target_duration_min: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 10 },
      host_notes: { type: Sequelize.TEXT, allowNull: true },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      current_script_version_id: { type: Sequelize.UUID, allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('podcast_episodes', ['status']);

    await queryInterface.createTable('podcast_episode_items', {
      id: { type: Sequelize.UUID, primaryKey: true },
      episode_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'podcast_episodes', key: 'id' },
        onDelete: 'CASCADE',
      },
      event_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'news_events', key: 'id' },
        onDelete: 'CASCADE',
      },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_selected: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      editor_note: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('podcast_episode_items', ['episode_id', 'sort_order']);
    await queryInterface.addIndex(
      'podcast_episode_items',
      ['episode_id', 'event_id'],
      { unique: true },
    );

    await queryInterface.createTable('podcast_script_versions', {
      id: { type: Sequelize.UUID, primaryKey: true },
      episode_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'podcast_episodes', key: 'id' },
        onDelete: 'CASCADE',
      },
      version: { type: Sequelize.INTEGER, allowNull: false },
      status: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'draft' },
      title: { type: Sequelize.STRING(300), allowNull: false },
      body_md: { type: Sequelize.TEXT, allowNull: false },
      word_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      estimated_duration_sec: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      claims_json: { type: Sequelize.JSONB, allowNull: false, defaultValue: '[]' },
      segments_json: { type: Sequelize.JSONB, allowNull: false, defaultValue: '[]' },
      fact_check_json: { type: Sequelize.JSONB, allowNull: true },
      generator: { type: Sequelize.STRING(64), allowNull: false, defaultValue: 'mock-v1' },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex(
      'podcast_script_versions',
      ['episode_id', 'version'],
      { unique: true },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('podcast_script_versions');
    await queryInterface.dropTable('podcast_episode_items');
    await queryInterface.dropTable('podcast_episodes');
  },
};
