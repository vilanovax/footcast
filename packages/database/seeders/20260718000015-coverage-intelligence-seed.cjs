'use strict';

const { randomUUID } = require('node:crypto');

const TEAM_IDS = {
  'iran-national': 'a1000000-0000-4000-8000-000000000001',
  esteghlal: 'a1000000-0000-4000-8000-000000000002',
  persepolis: 'a1000000-0000-4000-8000-000000000003',
  sepahan: 'a1000000-0000-4000-8000-000000000004',
  tractor: 'a1000000-0000-4000-8000-000000000005',
};

const COMP_IDS = {
  'iran-pro-league': 'b1000000-0000-4000-8000-000000000001',
  'premier-league': 'b1000000-0000-4000-8000-000000000002',
  'la-liga': 'b1000000-0000-4000-8000-000000000003',
  'serie-a': 'b1000000-0000-4000-8000-000000000004',
  bundesliga: 'b1000000-0000-4000-8000-000000000005',
  ucl: 'b1000000-0000-4000-8000-000000000006',
};

const WC_ID = 'c1000000-0000-4000-8000-000000000001';

async function ensureRow(qi, table, whereSql, whereReplacements, row) {
  const [existing] = await qi.sequelize.query(whereSql, {
    replacements: whereReplacements,
    type: qi.sequelize.QueryTypes.SELECT,
  });
  if (existing) return existing.id;
  await qi.bulkInsert(table, [row]);
  return row.id;
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const teams = [
      {
        id: TEAM_IDS['iran-national'],
        slug: 'iran-national',
        name_fa: 'تیم ملی ایران',
        name_en: 'Iran National Team',
        scope: 'IRAN',
        is_key_team: true,
        aliases: JSON.stringify([
          'تیم ملی',
          'تیم ملی ایران',
          'ایران',
          'iran',
          'iran national',
          'team melli',
        ]),
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: TEAM_IDS.esteghlal,
        slug: 'esteghlal',
        name_fa: 'استقلال',
        name_en: 'Esteghlal',
        scope: 'IRAN',
        is_key_team: true,
        aliases: JSON.stringify(['استقلال', 'استقلال تهران', 'esteghlal', 'esteghlal fc']),
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: TEAM_IDS.persepolis,
        slug: 'persepolis',
        name_fa: 'پرسپولیس',
        name_en: 'Persepolis',
        scope: 'IRAN',
        is_key_team: true,
        aliases: JSON.stringify(['پرسپولیس', 'persepolis', 'perspolis', 'perspolis fc']),
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: TEAM_IDS.sepahan,
        slug: 'sepahan',
        name_fa: 'سپاهان',
        name_en: 'Sepahan',
        scope: 'IRAN',
        is_key_team: true,
        aliases: JSON.stringify(['سپاهان', 'sepahan', 'sepahan fc']),
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: TEAM_IDS.tractor,
        slug: 'tractor',
        name_fa: 'تراکتور',
        name_en: 'Tractor',
        scope: 'IRAN',
        is_key_team: true,
        aliases: JSON.stringify(['تراکتور', 'تراکتورسازی', 'tractor', 'tractor sc']),
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ];

    for (const t of teams) {
      await ensureRow(
        queryInterface,
        'editorial_teams',
        `SELECT id FROM editorial_teams WHERE slug = :slug LIMIT 1`,
        { slug: t.slug },
        t,
      );
    }

    const comps = [
      {
        id: COMP_IDS['iran-pro-league'],
        slug: 'iran-pro-league',
        name_fa: 'لیگ برتر ایران',
        name_en: 'Iran Pro League',
        kind: 'LEAGUE',
        region: 'IRAN',
        aliases: JSON.stringify([
          'لیگ برتر',
          'لیگ ایران',
          'persian gulf pro league',
          'iran pro league',
          'ipl',
        ]),
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: COMP_IDS['premier-league'],
        slug: 'premier-league',
        name_fa: 'لیگ انگلیس',
        name_en: 'Premier League',
        kind: 'LEAGUE',
        region: 'EUROPE',
        aliases: JSON.stringify(['premier league', 'epl', 'لیگ برتر انگلیس', 'لیگ انگلیس']),
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: COMP_IDS['la-liga'],
        slug: 'la-liga',
        name_fa: 'لالیگا',
        name_en: 'La Liga',
        kind: 'LEAGUE',
        region: 'EUROPE',
        aliases: JSON.stringify(['la liga', 'laliga', 'لالیگا']),
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: COMP_IDS['serie-a'],
        slug: 'serie-a',
        name_fa: 'سری‌آ',
        name_en: 'Serie A',
        kind: 'LEAGUE',
        region: 'EUROPE',
        aliases: JSON.stringify(['serie a', 'seria a', 'سری آ', 'سری‌آ']),
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: COMP_IDS.bundesliga,
        slug: 'bundesliga',
        name_fa: 'بوندس‌لیگا',
        name_en: 'Bundesliga',
        kind: 'LEAGUE',
        region: 'EUROPE',
        aliases: JSON.stringify(['bundesliga', 'بوندسلیگا', 'بوندس‌لیگا']),
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: COMP_IDS.ucl,
        slug: 'ucl',
        name_fa: 'لیگ قهرمانان اروپا',
        name_en: 'UEFA Champions League',
        kind: 'TOURNAMENT',
        region: 'EUROPE',
        aliases: JSON.stringify([
          'ucl',
          'champions league',
          'لیگ قهرمانان',
          'لیگ قهرمانان اروپا',
        ]),
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ];

    for (const c of comps) {
      await ensureRow(
        queryInterface,
        'competitions',
        `SELECT id FROM competitions WHERE slug = :slug LIMIT 1`,
        { slug: c.slug },
        c,
      );
    }

    await ensureRow(
      queryInterface,
      'tracked_events',
      `SELECT id FROM tracked_events WHERE slug = :slug LIMIT 1`,
      { slug: 'world-cup-2026' },
      {
        id: WC_ID,
        slug: 'world-cup-2026',
        title: 'جام جهانی ۲۰۲۶',
        type: 'WORLD_CUP',
        competition_id: null,
        starts_at: new Date('2026-06-01T00:00:00.000Z'),
        ends_at: new Date('2026-07-20T00:00:00.000Z'),
        priority: 100,
        target_news_count: 4,
        target_duration_seconds: 240,
        active_boost: 25,
        aliases: JSON.stringify([
          'جام جهانی',
          'world cup',
          'world cup 2026',
          'wc2026',
          'فیفا',
        ]),
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    );

    const targets = [
      ['SCOPE', 'IRAN', 'فوتبال ایران', 4, 7],
      ['SCOPE', 'EUROPE', 'فوتبال اروپا', 3, 7],
      ['COMPETITION', 'iran-pro-league', 'لیگ ایران', 4, 7],
      ['COMPETITION', 'premier-league', 'لیگ انگلیس', 1, 3],
      ['COMPETITION', 'la-liga', 'لالیگا', 1, 2],
      ['COMPETITION', 'serie-a', 'سری‌آ', 1, 2],
      ['COMPETITION', 'bundesliga', 'بوندس‌لیگا', 0, 1],
      ['COMPETITION', 'ucl', 'لیگ قهرمانان', 2, 4],
      ['TEAM', 'esteghlal', 'استقلال', null, 2],
      ['TEAM', 'persepolis', 'پرسپولیس', null, 2],
      ['TEAM', 'sepahan', 'سپاهان', null, 2],
      ['TEAM', 'tractor', 'تراکتور', null, 2],
      ['TEAM', 'iran-national', 'تیم ملی ایران', null, 2],
      ['TRACKED_EVENT', 'world-cup-2026', 'جام جهانی ۲۰۲۶', 3, 5],
      ['CATEGORY', 'TRANSFER', 'نقل‌وانتقالات', 0, 4],
    ];

    for (const [dimension, key, label, minC, maxC] of targets) {
      await ensureRow(
        queryInterface,
        'coverage_targets',
        `SELECT id FROM coverage_targets WHERE dimension = :dimension AND key = :key LIMIT 1`,
        { dimension, key },
        {
          id: randomUUID(),
          dimension,
          key,
          label,
          min_selected_count: minC,
          max_selected_count: maxC,
          min_duration_seconds: null,
          max_duration_seconds: null,
          priority: 50,
          enforcement: 'SOFT',
          editorial_profile_id: 'default',
          is_active: true,
          created_at: now,
          updated_at: now,
        },
      );
    }

    const weights = [
      ['TEAM', TEAM_IDS.esteghlal, 'esteghlal', 90, 95, 0],
      ['TEAM', TEAM_IDS.persepolis, 'persepolis', 90, 95, 0],
      ['TEAM', TEAM_IDS.sepahan, 'sepahan', 75, 75, 0],
      ['TEAM', TEAM_IDS.tractor, 'tractor', 70, 72, 0],
      ['TEAM', TEAM_IDS['iran-national'], 'iran-national', 95, 98, 0],
      ['TRACKED_EVENT', WC_ID, 'world-cup-2026', 100, 100, 25],
    ];

    for (const [entityType, entityId, entityKey, base, audience, boost] of weights) {
      await ensureRow(
        queryInterface,
        'editorial_entity_weights',
        `SELECT id FROM editorial_entity_weights WHERE entity_type = :entityType AND entity_key = :entityKey LIMIT 1`,
        { entityType, entityKey },
        {
          id: randomUUID(),
          entity_type: entityType,
          entity_id: entityId,
          entity_key: entityKey,
          base_weight: base,
          audience_weight: audience,
          event_boost: boost,
          effective_from: null,
          effective_to: null,
          is_active: true,
          created_at: now,
          updated_at: now,
        },
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('editorial_entity_weights', null, {});
    await queryInterface.bulkDelete('coverage_targets', null, {});
    await queryInterface.bulkDelete('tracked_events', null, {});
    await queryInterface.bulkDelete('competitions', null, {});
    await queryInterface.bulkDelete('editorial_teams', null, {});
  },
};
