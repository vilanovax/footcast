'use strict';

const { randomUUID } = require('crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const codes = ['events:read', 'events:write', 'events:merge'];

    for (const code of codes) {
      const [rows] = await queryInterface.sequelize.query(
        `SELECT id FROM permissions WHERE code = :code LIMIT 1`,
        { replacements: { code } },
      );
      if (rows[0]) continue;
      await queryInterface.bulkInsert('permissions', [
        {
          id: randomUUID(),
          code,
          description: code,
          created_at: now,
          updated_at: now,
        },
      ]);
    }

    const [adminRoles] = await queryInterface.sequelize.query(
      `SELECT id FROM roles WHERE name = 'system_admin' LIMIT 1`,
    );
    const [editorRoles] = await queryInterface.sequelize.query(
      `SELECT id FROM roles WHERE name = 'editor' LIMIT 1`,
    );
    const adminId = adminRoles[0]?.id;
    const editorId = editorRoles[0]?.id;
    if (!adminId) return;

    const [perms] = await queryInterface.sequelize.query(
      `SELECT id, code FROM permissions WHERE code IN ('events:read','events:write','events:merge')`,
    );

    for (const perm of perms) {
      for (const roleId of [adminId, editorId].filter(Boolean)) {
        if (roleId === editorId && perm.code === 'events:merge') {
          // editors also get merge for Phase 4 ops
        }
        const [existing] = await queryInterface.sequelize.query(
          `SELECT 1 FROM role_permissions WHERE role_id = :roleId AND permission_id = :permId LIMIT 1`,
          { replacements: { roleId, permId: perm.id } },
        );
        if (existing[0]) continue;
        await queryInterface.bulkInsert('role_permissions', [
          { role_id: roleId, permission_id: perm.id },
        ]);
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code LIKE 'events:%')`,
    );
    await queryInterface.sequelize.query(
      `DELETE FROM permissions WHERE code IN ('events:read','events:write','events:merge')`,
    );
  },
};
