'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ai_requests', 'related_episode_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'podcast_episodes', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('ai_requests', ['related_episode_id']);

    await queryInterface.createTable('notifications', {
      id: { type: Sequelize.UUID, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      type: { type: Sequelize.STRING(64), allowNull: false },
      title: { type: Sequelize.STRING(255), allowNull: false },
      body: { type: Sequelize.TEXT, allowNull: true },
      entity_type: { type: Sequelize.STRING(64), allowNull: true },
      entity_id: { type: Sequelize.STRING(64), allowNull: true },
      href: { type: Sequelize.STRING(500), allowNull: true },
      read_at: { type: Sequelize.DATE, allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('notifications', ['user_id', 'created_at']);
    await queryInterface.addIndex('notifications', ['read_at']);
    await queryInterface.addIndex('notifications', ['type']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notifications');
    await queryInterface.removeIndex('ai_requests', ['related_episode_id']);
    await queryInterface.removeColumn('ai_requests', 'related_episode_id');
  },
};
