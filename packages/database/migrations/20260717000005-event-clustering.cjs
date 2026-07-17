'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Prefer pgvector when available (pgvector docker image); ignore on vanilla Postgres.
    try {
      await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS vector');
    } catch {
      // extension optional for Phase 4 JSONB embeddings
    }

    await queryInterface.createTable('news_events', {
      id: { type: Sequelize.UUID, primaryKey: true },
      title: { type: Sequelize.STRING(500), allowNull: false },
      summary: { type: Sequelize.TEXT, allowNull: true },
      status: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'NEW',
      },
      scope: { type: Sequelize.STRING(32), allowNull: true },
      category: { type: Sequelize.STRING(64), allowNull: true },
      official_status: { type: Sequelize.STRING(64), allowNull: true },
      importance_score: { type: Sequelize.INTEGER, allowNull: true },
      credibility_score: { type: Sequelize.INTEGER, allowNull: true },
      freshness_score: { type: Sequelize.INTEGER, allowNull: true },
      primary_article_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'raw_articles', key: 'id' },
        onDelete: 'SET NULL',
      },
      article_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      fingerprint: { type: Sequelize.STRING(64), allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: true },
      first_seen_at: { type: Sequelize.DATE, allowNull: false },
      last_seen_at: { type: Sequelize.DATE, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('news_events', ['status']);
    await queryInterface.addIndex('news_events', ['category']);
    await queryInterface.addIndex('news_events', ['scope']);
    await queryInterface.addIndex('news_events', ['fingerprint']);
    await queryInterface.addIndex('news_events', ['last_seen_at']);

    await queryInterface.createTable('news_event_articles', {
      id: { type: Sequelize.UUID, primaryKey: true },
      event_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'news_events', key: 'id' },
        onDelete: 'CASCADE',
      },
      article_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'raw_articles', key: 'id' },
        onDelete: 'CASCADE',
      },
      extraction_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'article_extractions', key: 'id' },
        onDelete: 'SET NULL',
      },
      role: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'primary' },
      match_method: { type: Sequelize.STRING(32), allowNull: true },
      similarity_score: { type: Sequelize.FLOAT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('news_event_articles', ['event_id']);

    await queryInterface.createTable('news_event_conflicts', {
      id: { type: Sequelize.UUID, primaryKey: true },
      event_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'news_events', key: 'id' },
        onDelete: 'CASCADE',
      },
      article_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'raw_articles', key: 'id' },
        onDelete: 'CASCADE',
      },
      other_event_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'news_events', key: 'id' },
        onDelete: 'SET NULL',
      },
      conflict_type: { type: Sequelize.STRING(64), allowNull: false },
      status: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'open' },
      details: { type: Sequelize.JSONB, allowNull: true },
      resolved_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('news_event_conflicts', ['status']);
    await queryInterface.addIndex('news_event_conflicts', ['event_id']);

    await queryInterface.createTable('article_embeddings', {
      article_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        references: { model: 'raw_articles', key: 'id' },
        onDelete: 'CASCADE',
      },
      extraction_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'article_extractions', key: 'id' },
        onDelete: 'SET NULL',
      },
      provider: { type: Sequelize.STRING(64), allowNull: false },
      model: { type: Sequelize.STRING(120), allowNull: false },
      dimensions: { type: Sequelize.INTEGER, allowNull: false },
      embedding: { type: Sequelize.JSONB, allowNull: false },
      content_hash: { type: Sequelize.STRING(64), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('article_embeddings', ['content_hash']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('article_embeddings');
    await queryInterface.dropTable('news_event_conflicts');
    await queryInterface.dropTable('news_event_articles');
    await queryInterface.dropTable('news_events');
  },
};
