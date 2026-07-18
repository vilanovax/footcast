'use strict';

const { randomUUID } = require('crypto');

/**
 * P0 scoring hygiene:
 * - normalize news_events.scope to IRAN|EUROPE|BOTH|OTHER
 * - recalibrate Source.credibility_seed by type + known slugs
 * - ensure common Iran sports media rows exist (idempotent)
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const qi = queryInterface.sequelize;

    await qi.query(`
      UPDATE news_events
      SET scope = 'IRAN', updated_at = NOW()
      WHERE scope IS NOT NULL
        AND lower(trim(scope)) IN ('iran', 'ir', 'ایران')
    `);
    await qi.query(`
      UPDATE news_events
      SET scope = 'EUROPE', updated_at = NOW()
      WHERE scope IS NOT NULL
        AND lower(trim(scope)) IN ('europe', 'eu', 'اروپا')
    `);
    await qi.query(`
      UPDATE news_events
      SET scope = 'BOTH', updated_at = NOW()
      WHERE scope IS NOT NULL
        AND lower(trim(scope)) IN ('both', 'هردو')
    `);
    await qi.query(`
      UPDATE news_events
      SET scope = 'OTHER', updated_at = NOW()
      WHERE scope IS NOT NULL
        AND upper(trim(scope)) NOT IN ('IRAN', 'EUROPE', 'BOTH', 'OTHER')
    `);

    await qi.query(`
      UPDATE sources SET credibility_seed = CASE source_type
        WHEN 'OFFICIAL_CLUB' THEN 95
        WHEN 'OFFICIAL_FEDERATION' THEN 95
        WHEN 'OFFICIAL_LEAGUE' THEN 92
        WHEN 'NEWS_AGENCY' THEN 85
        WHEN 'TRUSTED_NEWSPAPER' THEN 88
        WHEN 'TRANSFER_REPORTER' THEN 78
        WHEN 'LOCAL_SPORTS_MEDIA' THEN 72
        WHEN 'AGGREGATOR' THEN 40
        WHEN 'SOCIAL_MEDIA' THEN 35
        WHEN 'UNTRUSTED_SOURCE' THEN 25
        ELSE credibility_seed
      END,
      updated_at = :now
      WHERE credibility_seed <= 55
    `, { replacements: { now } });

    // Known high-signal outlets (override even if already set)
    await qi.query(`
      UPDATE sources SET credibility_seed = v.seed, updated_at = :now
      FROM (VALUES
        ('irna-sports-sample', 88),
        ('bbc-football', 90),
        ('guardian-football', 88),
        ('varzesh3', 74),
        ('varzesh-3', 74),
        ('varzeshe3', 74),
        ('isna-sports', 82),
        ('tasnim-sports', 80),
        ('mehr-sports', 80),
        ('fars-sports', 78)
      ) AS v(slug, seed)
      WHERE sources.slug = v.slug
    `, { replacements: { now } });

    // Name-based boost for ورزش۳ if slug varies
    await qi.query(`
      UPDATE sources
      SET credibility_seed = GREATEST(credibility_seed, 74),
          source_type = CASE
            WHEN source_type IN ('AGGREGATOR', 'UNTRUSTED_SOURCE', 'SOCIAL_MEDIA')
              THEN 'LOCAL_SPORTS_MEDIA'
            ELSE source_type
          END,
          updated_at = :now
      WHERE name ILIKE '%ورزش%۳%'
         OR name ILIKE '%ورزش 3%'
         OR name ILIKE '%varzesh%3%'
         OR slug ILIKE '%varzesh%3%'
    `, { replacements: { now } });

    const iranSources = [
      {
        slug: 'varzesh3',
        name: 'ورزش۳',
        source_type: 'LOCAL_SPORTS_MEDIA',
        credibility_seed: 74,
        base_url: 'https://www.varzesh3.com',
        rss_url: 'https://www.varzesh3.com/rss/all',
        coverage_scope: 'IRAN',
        priority: 15,
      },
      {
        slug: 'isna-sports',
        name: 'ایسنا ورزش',
        source_type: 'NEWS_AGENCY',
        credibility_seed: 82,
        base_url: 'https://www.isna.ir',
        rss_url: 'https://www.isna.ir/rss/tp/24',
        coverage_scope: 'IRAN',
        priority: 18,
      },
    ];

    for (const s of iranSources) {
      const [existing] = await qi.query(
        `SELECT id FROM sources WHERE slug = :slug LIMIT 1`,
        { replacements: { slug: s.slug }, type: qi.QueryTypes.SELECT },
      );
      if (existing) continue;

      const id = randomUUID();
      await queryInterface.bulkInsert('sources', [
        {
          id,
          name: s.name,
          slug: s.slug,
          source_type: s.source_type,
          country_code: 'IR',
          language: 'fa',
          base_url: s.base_url,
          rss_url: s.rss_url,
          sitemap_url: null,
          credibility_seed: s.credibility_seed,
          priority: s.priority,
          fetch_interval_sec: 1200,
          requires_javascript: false,
          rate_limit_per_minute: 6,
          is_active: true,
          coverage_scope: s.coverage_scope,
          metadata: JSON.stringify({ seededBy: 'scoring-p0' }),
          created_at: now,
          updated_at: now,
        },
      ]);
      await queryInterface.bulkInsert('source_feeds', [
        {
          id: randomUUID(),
          source_id: id,
          feed_type: 'rss',
          url: s.rss_url,
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
          source_id: id,
          status: 'unknown',
          last_success_at: null,
          last_error_at: null,
          consecutive_failures: 0,
          last_error_message: null,
          updated_at: now,
        },
      ]);
    }
  },

  async down() {
    // Non-destructive: do not revert seeds/scopes
  },
};
