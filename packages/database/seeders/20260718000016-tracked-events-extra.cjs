'use strict';

const { randomUUID } = require('node:crypto');

async function ensureTracked(qi, row) {
  const [existing] = await qi.sequelize.query(
    `SELECT id FROM tracked_events WHERE slug = :slug LIMIT 1`,
    {
      replacements: { slug: row.slug },
      type: qi.sequelize.QueryTypes.SELECT,
    },
  );
  if (existing) return;
  await qi.bulkInsert('tracked_events', [row]);
}

async function ensureTarget(qi, row) {
  const [existing] = await qi.sequelize.query(
    `SELECT id FROM coverage_targets WHERE dimension = :dimension AND key = :key LIMIT 1`,
    {
      replacements: { dimension: row.dimension, key: row.key },
      type: qi.sequelize.QueryTypes.SELECT,
    },
  );
  if (existing) return;
  await qi.bulkInsert('coverage_targets', [row]);
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const year = now.getUTCFullYear();

    await ensureTracked(queryInterface, {
      id: 'c1000000-0000-4000-8000-000000000002',
      slug: 'tehran-derby',
      title: 'دربی تهران',
      type: 'DERBY',
      competition_id: 'b1000000-0000-4000-8000-000000000001',
      starts_at: null,
      ends_at: null,
      priority: 90,
      target_news_count: 2,
      target_duration_seconds: 120,
      active_boost: 15,
      aliases: JSON.stringify([
        'دربی',
        'دربی تهران',
        'استقلال پرسپولیس',
        'پرسپولیس استقلال',
        'tehran derby',
        'derby',
      ]),
      is_active: true,
      created_at: now,
      updated_at: now,
    });

    await ensureTracked(queryInterface, {
      id: 'c1000000-0000-4000-8000-000000000003',
      slug: `transfer-window-${year}`,
      title: `پنجره نقل‌وانتقالات ${year}`,
      type: 'TRANSFER_WINDOW',
      competition_id: null,
      starts_at: new Date(`${year}-06-01T00:00:00.000Z`),
      ends_at: new Date(`${year}-09-15T00:00:00.000Z`),
      priority: 70,
      target_news_count: 3,
      target_duration_seconds: 180,
      active_boost: 10,
      aliases: JSON.stringify([
        'پنجره نقل و انتقالات',
        'نقل و انتقالات',
        'transfer window',
        'transfermarkt',
        'تابستانی',
      ]),
      is_active: true,
      created_at: now,
      updated_at: now,
    });

    await ensureTracked(queryInterface, {
      id: 'c1000000-0000-4000-8000-000000000004',
      slug: 'iran-league-final-weeks',
      title: 'هفته‌های پایانی لیگ ایران',
      type: 'LEAGUE_RUN_IN',
      competition_id: 'b1000000-0000-4000-8000-000000000001',
      starts_at: null,
      ends_at: null,
      priority: 65,
      target_news_count: 2,
      target_duration_seconds: 100,
      active_boost: 8,
      aliases: JSON.stringify([
        'هفته پایانی',
        'قهرمانی لیگ',
        'جدول لیگ برتر',
        'عنوان قهرمانی',
      ]),
      is_active: true,
      created_at: now,
      updated_at: now,
    });

    for (const [key, label, minC, maxC] of [
      ['tehran-derby', 'دربی تهران', 1, 3],
      [`transfer-window-${year}`, 'پنجره نقل‌وانتقالات', 0, 4],
      ['iran-league-final-weeks', 'هفته‌های پایانی لیگ', 0, 2],
    ]) {
      await ensureTarget(queryInterface, {
        id: randomUUID(),
        dimension: 'TRACKED_EVENT',
        key,
        label,
        min_selected_count: minC,
        max_selected_count: maxC,
        min_duration_seconds: null,
        max_duration_seconds: null,
        priority: 55,
        enforcement: 'SOFT',
        editorial_profile_id: 'default',
        is_active: true,
        created_at: now,
        updated_at: now,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('coverage_targets', {
      key: ['tehran-derby', 'iran-league-final-weeks'],
    });
    await queryInterface.bulkDelete('tracked_events', {
      slug: ['tehran-derby', 'iran-league-final-weeks'],
    });
  },
};
