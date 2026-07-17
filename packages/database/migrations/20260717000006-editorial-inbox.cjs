'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('editorial_rules', {
      id: { type: Sequelize.UUID, primaryKey: true },
      code: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      title_fa: { type: Sequelize.STRING(255), allowNull: false },
      description_fa: { type: Sequelize.TEXT, allowNull: true },
      severity: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'soft' },
      enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      config: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('editorial_scores', {
      id: { type: Sequelize.UUID, primaryKey: true },
      event_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'news_events', key: 'id' },
        onDelete: 'CASCADE',
      },
      final_score: { type: Sequelize.INTEGER, allowNull: false },
      factors: { type: Sequelize.JSONB, allowNull: false },
      penalties: { type: Sequelize.JSONB, allowNull: false },
      rule_hits: { type: Sequelize.JSONB, allowNull: false },
      breakdown: { type: Sequelize.JSONB, allowNull: true },
      scorer_version: { type: Sequelize.STRING(32), allowNull: false, defaultValue: '1.0.0' },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('editorial_scores', ['event_id']);
    await queryInterface.addIndex('editorial_scores', ['final_score']);

    await queryInterface.createTable('editorial_decisions', {
      id: { type: Sequelize.UUID, primaryKey: true },
      event_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'news_events', key: 'id' },
        onDelete: 'CASCADE',
      },
      actor_user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      decision: { type: Sequelize.STRING(32), allowNull: false },
      reason: { type: Sequelize.TEXT, allowNull: true },
      previous_status: { type: Sequelize.STRING(32), allowNull: true },
      next_status: { type: Sequelize.STRING(32), allowNull: false },
      metadata: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('editorial_decisions', ['event_id']);
    await queryInterface.addIndex('editorial_decisions', ['decision']);

    await queryInterface.createTable('editorial_notes', {
      id: { type: Sequelize.UUID, primaryKey: true },
      event_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'news_events', key: 'id' },
        onDelete: 'CASCADE',
      },
      author_user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      body: { type: Sequelize.TEXT, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('editorial_notes', ['event_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('editorial_notes');
    await queryInterface.dropTable('editorial_decisions');
    await queryInterface.dropTable('editorial_scores');
    await queryInterface.dropTable('editorial_rules');
  },
};
