'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('podcast_audios', {
      id: { type: Sequelize.UUID, primaryKey: true },
      episode_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'podcast_episodes', key: 'id' },
        onDelete: 'CASCADE',
      },
      script_version_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'podcast_script_versions', key: 'id' },
        onDelete: 'SET NULL',
      },
      provider: { type: Sequelize.STRING(64), allowNull: false },
      model: { type: Sequelize.STRING(120), allowNull: false },
      voice_id: { type: Sequelize.STRING(120), allowNull: false },
      mime_type: { type: Sequelize.STRING(64), allowNull: false },
      storage_path: { type: Sequelize.STRING(1000), allowNull: false },
      public_url: { type: Sequelize.STRING(1000), allowNull: true },
      file_size_bytes: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      duration_sec: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      reported_duration_sec: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      status: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'ready' },
      metadata: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('podcast_audios', ['episode_id']);

    await queryInterface.createTable('podcast_publications', {
      id: { type: Sequelize.UUID, primaryKey: true },
      episode_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'podcast_episodes', key: 'id' },
        onDelete: 'CASCADE',
      },
      audio_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'podcast_audios', key: 'id' },
        onDelete: 'CASCADE',
      },
      title: { type: Sequelize.STRING(300), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      audio_url: { type: Sequelize.STRING(1000), allowNull: false },
      guid: { type: Sequelize.STRING(160), allowNull: false, unique: true },
      published_at: { type: Sequelize.DATE, allowNull: false },
      rss_metadata: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('podcast_publications');
    await queryInterface.dropTable('podcast_audios');
  },
};
