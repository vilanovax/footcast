'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: { type: Sequelize.UUID, primaryKey: true },
      email: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING(255), allowNull: false },
      display_name: { type: Sequelize.STRING(120), allowNull: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('roles', {
      id: { type: Sequelize.UUID, primaryKey: true },
      name: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      description: { type: Sequelize.STRING(255), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('permissions', {
      id: { type: Sequelize.UUID, primaryKey: true },
      code: { type: Sequelize.STRING(128), allowNull: false, unique: true },
      description: { type: Sequelize.STRING(255), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('user_roles', {
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      role_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'roles', key: 'id' },
        onDelete: 'CASCADE',
      },
    });

    await queryInterface.createTable('role_permissions', {
      role_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'roles', key: 'id' },
        onDelete: 'CASCADE',
      },
      permission_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'permissions', key: 'id' },
        onDelete: 'CASCADE',
      },
    });

    await queryInterface.createTable('sources', {
      id: { type: Sequelize.UUID, primaryKey: true },
      name: { type: Sequelize.STRING(200), allowNull: false },
      slug: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      source_type: { type: Sequelize.STRING(64), allowNull: false },
      country_code: { type: Sequelize.STRING(2), allowNull: true },
      language: { type: Sequelize.STRING(8), allowNull: false, defaultValue: 'fa' },
      base_url: { type: Sequelize.STRING(500), allowNull: false },
      rss_url: { type: Sequelize.STRING(500), allowNull: true },
      sitemap_url: { type: Sequelize.STRING(500), allowNull: true },
      credibility_seed: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 50 },
      priority: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 100 },
      fetch_interval_sec: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 900 },
      requires_javascript: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      rate_limit_per_minute: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 10 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      coverage_scope: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'IRAN' },
      metadata: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('sources', ['is_active']);
    await queryInterface.addIndex('sources', ['coverage_scope']);

    await queryInterface.createTable('source_feeds', {
      id: { type: Sequelize.UUID, primaryKey: true },
      source_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'sources', key: 'id' },
        onDelete: 'CASCADE',
      },
      feed_type: { type: Sequelize.STRING(32), allowNull: false },
      url: { type: Sequelize.STRING(500), allowNull: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      last_etag: { type: Sequelize.STRING(255), allowNull: true },
      last_modified: { type: Sequelize.STRING(255), allowNull: true },
      last_fetched_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('source_feeds', ['source_id']);

    await queryInterface.createTable('source_health', {
      source_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        references: { model: 'sources', key: 'id' },
        onDelete: 'CASCADE',
      },
      status: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'unknown' },
      last_success_at: { type: Sequelize.DATE, allowNull: true },
      last_error_at: { type: Sequelize.DATE, allowNull: true },
      consecutive_failures: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      last_error_message: { type: Sequelize.TEXT, allowNull: true },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('raw_articles', {
      id: { type: Sequelize.UUID, primaryKey: true },
      source_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'sources', key: 'id' },
        onDelete: 'CASCADE',
      },
      canonical_url: { type: Sequelize.STRING(1000), allowNull: false },
      url_hash: { type: Sequelize.STRING(64), allowNull: false },
      title: { type: Sequelize.STRING(500), allowNull: true },
      status: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'DISCOVERED' },
      discovered_at: { type: Sequelize.DATE, allowNull: false },
      published_at: { type: Sequelize.DATE, allowNull: true },
      fetched_at: { type: Sequelize.DATE, allowNull: true },
      content_hash: { type: Sequelize.STRING(64), allowNull: true },
      http_status: { type: Sequelize.INTEGER, allowNull: true },
      error_message: { type: Sequelize.TEXT, allowNull: true },
      idempotency_key: { type: Sequelize.STRING(128), allowNull: false, unique: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('raw_articles', ['source_id']);
    await queryInterface.addIndex('raw_articles', ['status']);
    await queryInterface.addIndex('raw_articles', ['url_hash']);
    await queryInterface.addIndex('raw_articles', ['discovered_at']);

    await queryInterface.createTable('app_settings', {
      key: { type: Sequelize.STRING(120), primaryKey: true },
      value: { type: Sequelize.JSONB, allowNull: false },
      description: { type: Sequelize.STRING(255), allowNull: true },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('audit_logs', {
      id: { type: Sequelize.UUID, primaryKey: true },
      actor_user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      action: { type: Sequelize.STRING(120), allowNull: false },
      entity_type: { type: Sequelize.STRING(120), allowNull: false },
      entity_id: { type: Sequelize.STRING(120), allowNull: true },
      before: { type: Sequelize.JSONB, allowNull: true },
      after: { type: Sequelize.JSONB, allowNull: true },
      ip: { type: Sequelize.STRING(64), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('audit_logs', ['entity_type', 'entity_id']);
    await queryInterface.addIndex('audit_logs', ['created_at']);

    await queryInterface.createTable('refresh_tokens', {
      id: { type: Sequelize.UUID, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      token_hash: { type: Sequelize.STRING(128), allowNull: false, unique: true },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      revoked_at: { type: Sequelize.DATE, allowNull: true },
      replaced_by_token_id: { type: Sequelize.UUID, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('refresh_tokens', ['user_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('refresh_tokens');
    await queryInterface.dropTable('audit_logs');
    await queryInterface.dropTable('app_settings');
    await queryInterface.dropTable('raw_articles');
    await queryInterface.dropTable('source_health');
    await queryInterface.dropTable('source_feeds');
    await queryInterface.dropTable('sources');
    await queryInterface.dropTable('role_permissions');
    await queryInterface.dropTable('user_roles');
    await queryInterface.dropTable('permissions');
    await queryInterface.dropTable('roles');
    await queryInterface.dropTable('users');
  },
};
