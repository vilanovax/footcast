'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('prompt_templates', {
      id: { type: Sequelize.UUID, primaryKey: true },
      name: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      pipeline_stage: { type: Sequelize.STRING(64), allowNull: false },
      description: { type: Sequelize.STRING(255), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('prompt_versions', {
      id: { type: Sequelize.UUID, primaryKey: true },
      template_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'prompt_templates', key: 'id' },
        onDelete: 'CASCADE',
      },
      version: { type: Sequelize.INTEGER, allowNull: false },
      provider: { type: Sequelize.STRING(64), allowNull: false },
      model: { type: Sequelize.STRING(120), allowNull: false },
      system_prompt: { type: Sequelize.TEXT, allowNull: false },
      user_prompt_template: { type: Sequelize.TEXT, allowNull: false },
      json_schema: { type: Sequelize.JSONB, allowNull: true },
      temperature: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0.2 },
      max_tokens: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 2000 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_by: { type: Sequelize.STRING(120), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('prompt_versions', ['template_id', 'version'], { unique: true });
    await queryInterface.addIndex('prompt_versions', ['is_active']);

    await queryInterface.createTable('ai_requests', {
      id: { type: Sequelize.UUID, primaryKey: true },
      provider: { type: Sequelize.STRING(64), allowNull: false },
      model: { type: Sequelize.STRING(120), allowNull: false },
      pipeline_stage: { type: Sequelize.STRING(64), allowNull: false },
      prompt_version_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'prompt_versions', key: 'id' },
        onDelete: 'SET NULL',
      },
      related_article_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'raw_articles', key: 'id' },
        onDelete: 'SET NULL',
      },
      input_tokens: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      output_tokens: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      cached_input_tokens: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      reasoning_tokens: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      estimated_cost: { type: Sequelize.DECIMAL(12, 6), allowNull: false, defaultValue: 0 },
      actual_cost: { type: Sequelize.DECIMAL(12, 6), allowNull: true },
      latency_ms: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      status: { type: Sequelize.STRING(32), allowNull: false },
      error: { type: Sequelize.TEXT, allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('ai_requests', ['pipeline_stage']);
    await queryInterface.addIndex('ai_requests', ['related_article_id']);
    await queryInterface.addIndex('ai_requests', ['created_at']);

    await queryInterface.createTable('article_extractions', {
      id: { type: Sequelize.UUID, primaryKey: true },
      article_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'raw_articles', key: 'id' },
        onDelete: 'CASCADE',
      },
      prompt_version_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'prompt_versions', key: 'id' },
        onDelete: 'SET NULL',
      },
      ai_request_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'ai_requests', key: 'id' },
        onDelete: 'SET NULL',
      },
      card_json: { type: Sequelize.JSONB, allowNull: false },
      is_relevant: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      scope: { type: Sequelize.STRING(32), allowNull: true },
      category: { type: Sequelize.STRING(64), allowNull: true },
      headline_fa: { type: Sequelize.STRING(500), allowNull: true },
      summary_fa: { type: Sequelize.TEXT, allowNull: true },
      official_status: { type: Sequelize.STRING(64), allowNull: true },
      importance_score: { type: Sequelize.INTEGER, allowNull: true },
      credibility_score: { type: Sequelize.INTEGER, allowNull: true },
      freshness_score: { type: Sequelize.INTEGER, allowNull: true },
      validation_errors: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('article_extractions', ['article_id']);
    await queryInterface.addIndex('article_extractions', ['is_relevant']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('article_extractions');
    await queryInterface.dropTable('ai_requests');
    await queryInterface.dropTable('prompt_versions');
    await queryInterface.dropTable('prompt_templates');
  },
};
