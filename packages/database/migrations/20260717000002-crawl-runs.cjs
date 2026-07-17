'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('crawl_runs', {
      id: { type: Sequelize.UUID, primaryKey: true },
      source_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'sources', key: 'id' },
        onDelete: 'CASCADE',
      },
      source_feed_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'source_feeds', key: 'id' },
        onDelete: 'SET NULL',
      },
      status: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'PENDING' },
      trigger: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'schedule' },
      job_id: { type: Sequelize.STRING(128), allowNull: true },
      started_at: { type: Sequelize.DATE, allowNull: true },
      finished_at: { type: Sequelize.DATE, allowNull: true },
      discovered_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      fetched_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      error_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      feed_url: { type: Sequelize.STRING(500), allowNull: true },
      http_status: { type: Sequelize.INTEGER, allowNull: true },
      message: { type: Sequelize.TEXT, allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('crawl_runs', ['source_id']);
    await queryInterface.addIndex('crawl_runs', ['status']);
    await queryInterface.addIndex('crawl_runs', ['started_at']);

    await queryInterface.createTable('crawl_errors', {
      id: { type: Sequelize.UUID, primaryKey: true },
      crawl_run_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'crawl_runs', key: 'id' },
        onDelete: 'CASCADE',
      },
      source_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'sources', key: 'id' },
        onDelete: 'CASCADE',
      },
      url: { type: Sequelize.STRING(1000), allowNull: true },
      code: { type: Sequelize.STRING(64), allowNull: false },
      message: { type: Sequelize.TEXT, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('crawl_errors', ['crawl_run_id']);
    await queryInterface.addIndex('crawl_errors', ['source_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('crawl_errors');
    await queryInterface.dropTable('crawl_runs');
  },
};
