'use strict';

const { randomUUID } = require('crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const codes = ['podcasts:publish'];
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

    const [roles] = await queryInterface.sequelize.query(
      `SELECT id FROM roles WHERE name IN ('system_admin','editor')`,
    );
    const [perms] = await queryInterface.sequelize.query(
      `SELECT id FROM permissions WHERE code = 'podcasts:publish'`,
    );
    for (const role of roles) {
      for (const perm of perms) {
        const [existing] = await queryInterface.sequelize.query(
          `SELECT 1 FROM role_permissions WHERE role_id = :roleId AND permission_id = :permId LIMIT 1`,
          { replacements: { roleId: role.id, permId: perm.id } },
        );
        if (existing[0]) continue;
        await queryInterface.bulkInsert('role_permissions', [
          { role_id: role.id, permission_id: perm.id },
        ]);
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code = 'podcasts:publish')`,
    );
    await queryInterface.sequelize.query(
      `DELETE FROM permissions WHERE code = 'podcasts:publish'`,
    );
  },
};
