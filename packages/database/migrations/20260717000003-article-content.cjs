'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('raw_articles', 'attempt_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('raw_articles', 'parsed_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('raw_articles', 'storage_path', {
      type: Sequelize.STRING(1000),
      allowNull: true,
    });

    await queryInterface.createTable('article_contents', {
      article_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        references: { model: 'raw_articles', key: 'id' },
        onDelete: 'CASCADE',
      },
      storage_path: { type: Sequelize.STRING(1000), allowNull: true },
      extracted_title: { type: Sequelize.STRING(500), allowNull: true },
      byline: { type: Sequelize.STRING(300), allowNull: true },
      language: { type: Sequelize.STRING(16), allowNull: true },
      text_content: { type: Sequelize.TEXT, allowNull: false },
      html_content: { type: Sequelize.TEXT, allowNull: true },
      word_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      char_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      parser_version: { type: Sequelize.STRING(32), allowNull: false, defaultValue: '1.0.0' },
      content_hash: { type: Sequelize.STRING(64), allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: true },
      parsed_at: { type: Sequelize.DATE, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('article_contents', ['parsed_at']);
    await queryInterface.addIndex('raw_articles', ['parsed_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('article_contents');
    await queryInterface.removeColumn('raw_articles', 'storage_path');
    await queryInterface.removeColumn('raw_articles', 'parsed_at');
    await queryInterface.removeColumn('raw_articles', 'attempt_count');
  },
};
