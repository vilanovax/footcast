'use strict';

const crypto = require('crypto');
const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const roles = {
      system_admin: randomUUID(),
      editor: randomUUID(),
      reporter: randomUUID(),
      content_manager: randomUUID(),
    };

    await queryInterface.bulkInsert('roles', [
      {
        id: roles.system_admin,
        name: 'system_admin',
        description: 'Full system access',
        created_at: now,
        updated_at: now,
      },
      {
        id: roles.editor,
        name: 'editor',
        description: 'Editorial inbox and episode review',
        created_at: now,
        updated_at: now,
      },
      {
        id: roles.reporter,
        name: 'reporter',
        description: 'Manual news and source suggestions',
        created_at: now,
        updated_at: now,
      },
      {
        id: roles.content_manager,
        name: 'content_manager',
        description: 'Episode tone, audio, publication',
        created_at: now,
        updated_at: now,
      },
    ]);

    const permissionCodes = [
      'users:read',
      'users:write',
      'roles:read',
      'sources:read',
      'sources:write',
      'articles:read',
      'articles:write',
      'articles:reprocess',
      'settings:read',
      'settings:write',
      'dashboard:read',
      'audit:read',
    ];

    const permissions = permissionCodes.map((code) => ({
      id: randomUUID(),
      code,
      description: code,
      created_at: now,
      updated_at: now,
    }));
    await queryInterface.bulkInsert('permissions', permissions);

    const byCode = Object.fromEntries(permissions.map((p) => [p.code, p.id]));
    const allPermIds = permissions.map((p) => p.id);
    const editorPerms = [
      'sources:read',
      'articles:read',
      'articles:write',
      'articles:reprocess',
      'settings:read',
      'dashboard:read',
    ].map((c) => byCode[c]);
    const reporterPerms = ['sources:read', 'articles:read', 'articles:write', 'dashboard:read'].map(
      (c) => byCode[c],
    );
    const contentPerms = ['articles:read', 'settings:read', 'dashboard:read'].map((c) => byCode[c]);

    const rolePermissions = [
      ...allPermIds.map((permission_id) => ({ role_id: roles.system_admin, permission_id })),
      ...editorPerms.map((permission_id) => ({ role_id: roles.editor, permission_id })),
      ...reporterPerms.map((permission_id) => ({ role_id: roles.reporter, permission_id })),
      ...contentPerms.map((permission_id) => ({ role_id: roles.content_manager, permission_id })),
    ];
    await queryInterface.bulkInsert('role_permissions', rolePermissions);

    const adminId = randomUUID();
    const passwordHash = bcrypt.hashSync('ChangeMeAdmin123!', 10);
    await queryInterface.bulkInsert('users', [
      {
        id: adminId,
        email: 'admin@football-newsroom.local',
        password_hash: passwordHash,
        display_name: 'System Admin',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ]);
    await queryInterface.bulkInsert('user_roles', [
      { user_id: adminId, role_id: roles.system_admin },
    ]);

    await queryInterface.bulkInsert('app_settings', [
      {
        key: 'product.name.en',
        value: JSON.stringify('Football Newsroom'),
        description: 'English product name',
        updated_at: now,
      },
      {
        key: 'product.name.fa',
        value: JSON.stringify('اتاق خبر فوتبال'),
        description: 'Persian product name',
        updated_at: now,
      },
      {
        key: 'podcast.target_minutes',
        value: JSON.stringify({ min: 8, max: 12, default: 10 }),
        description: 'Target podcast duration',
        updated_at: now,
      },
    ]);

    const sourceId = randomUUID();
    await queryInterface.bulkInsert('sources', [
      {
        id: sourceId,
        name: 'IRNA Sports Sample',
        slug: 'irna-sports-sample',
        source_type: 'NEWS_AGENCY',
        country_code: 'IR',
        language: 'fa',
        base_url: 'https://www.irna.ir',
        rss_url: 'https://www.irna.ir/rss',
        sitemap_url: null,
        credibility_seed: 85,
        priority: 10,
        fetch_interval_sec: 900,
        requires_javascript: false,
        rate_limit_per_minute: 6,
        is_active: true,
        coverage_scope: 'IRAN',
        metadata: JSON.stringify({ sample: true }),
        created_at: now,
        updated_at: now,
      },
    ]);

    await queryInterface.bulkInsert('source_feeds', [
      {
        id: randomUUID(),
        source_id: sourceId,
        feed_type: 'rss',
        url: 'https://www.irna.ir/rss',
        is_active: true,
        last_etag: null,
        last_modified: null,
        last_fetched_at: null,
        created_at: now,
        updated_at: now,
      },
    ]);

    await queryInterface.bulkInsert('source_health', [
      {
        source_id: sourceId,
        status: 'unknown',
        last_success_at: null,
        last_error_at: null,
        consecutive_failures: 0,
        last_error_message: null,
        updated_at: now,
      },
    ]);

    const articleUrl = 'https://www.irna.ir/sample/esteghlal-transfer';
    await queryInterface.bulkInsert('raw_articles', [
      {
        id: randomUUID(),
        source_id: sourceId,
        canonical_url: articleUrl,
        url_hash: sha256(articleUrl),
        title: 'نمونه خبر نقل‌وانتقال استقلال',
        status: 'DISCOVERED',
        discovered_at: now,
        published_at: now,
        fetched_at: null,
        content_hash: null,
        http_status: null,
        error_message: null,
        idempotency_key: `seed:${sha256(articleUrl)}`,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('raw_articles', null, {});
    await queryInterface.bulkDelete('source_health', null, {});
    await queryInterface.bulkDelete('source_feeds', null, {});
    await queryInterface.bulkDelete('sources', null, {});
    await queryInterface.bulkDelete('app_settings', null, {});
    await queryInterface.bulkDelete('user_roles', null, {});
    await queryInterface.bulkDelete('users', null, {});
    await queryInterface.bulkDelete('role_permissions', null, {});
    await queryInterface.bulkDelete('permissions', null, {});
    await queryInterface.bulkDelete('roles', null, {});
  },
};
