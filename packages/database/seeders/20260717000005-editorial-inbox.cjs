'use strict';

const { randomUUID } = require('crypto');

const RULES = [
  ['official_transfer_priority', 'اولویت انتقال رسمی', 'hard'],
  ['no_confirmed_from_talks', 'مذاکره برابر انتقال قطعی نیست', 'hard'],
  ['block_single_source_rumor', 'شایعه تک‌منبعی', 'hard'],
  ['club_official_over_repost', 'اولویت خبر رسمی باشگاه', 'soft'],
  ['duplicate_only_on_update', 'تکراری فقط با تحول', 'soft'],
  ['drop_low_value_results', 'حذف نتایج کم‌اهمیت', 'soft'],
  ['key_injury_boost', 'وزن مصدومیت کلیدی', 'soft'],
  ['esteghlal_persepolis_weight', 'وزن استقلال و پرسپولیس', 'soft'],
  ['national_team_priority', 'اهمیت تیم ملی', 'soft'],
  ['drop_clickbait', 'حذف کلیک‌خور', 'hard'],
  ['drop_stale_without_update', 'حذف قدیمی بدون تحول', 'soft'],
  ['conflict_to_human', 'تناقض به سردبیر', 'hard'],
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    for (const [code, titleFa, severity] of RULES) {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM editorial_rules WHERE code = :code LIMIT 1`,
        { replacements: { code } },
      );
      if (existing[0]) continue;
      await queryInterface.bulkInsert('editorial_rules', [
        {
          id: randomUUID(),
          code,
          title_fa: titleFa,
          description_fa: titleFa,
          severity,
          enabled: true,
          config: null,
          created_at: now,
          updated_at: now,
        },
      ]);
    }

    const permCodes = ['editorial:read', 'editorial:decide', 'editorial:notes'];
    for (const code of permCodes) {
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
      `SELECT id, name FROM roles WHERE name IN ('system_admin','editor')`,
    );
    const [perms] = await queryInterface.sequelize.query(
      `SELECT id, code FROM permissions WHERE code LIKE 'editorial:%'`,
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
      `DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code LIKE 'editorial:%')`,
    );
    await queryInterface.sequelize.query(
      `DELETE FROM permissions WHERE code LIKE 'editorial:%'`,
    );
    await queryInterface.bulkDelete('editorial_rules', null, {});
  },
};
