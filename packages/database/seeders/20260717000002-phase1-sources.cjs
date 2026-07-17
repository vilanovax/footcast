'use strict';

const { randomUUID } = require('crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const sources = [
      {
        id: randomUUID(),
        name: 'BBC Football',
        slug: 'bbc-football',
        source_type: 'TRUSTED_NEWSPAPER',
        country_code: 'GB',
        language: 'en',
        base_url: 'https://www.bbc.com/sport/football',
        rss_url: 'https://feeds.bbci.co.uk/sport/football/rss.xml',
        sitemap_url: null,
        credibility_seed: 90,
        priority: 20,
        fetch_interval_sec: 1800,
        requires_javascript: false,
        rate_limit_per_minute: 6,
        is_active: true,
        coverage_scope: 'EUROPE',
        metadata: JSON.stringify({ phase: 1 }),
        created_at: now,
        updated_at: now,
      },
      {
        id: randomUUID(),
        name: 'Guardian Football',
        slug: 'guardian-football',
        source_type: 'TRUSTED_NEWSPAPER',
        country_code: 'GB',
        language: 'en',
        base_url: 'https://www.theguardian.com/football',
        rss_url: 'https://www.theguardian.com/football/rss',
        sitemap_url: null,
        credibility_seed: 88,
        priority: 25,
        fetch_interval_sec: 1800,
        requires_javascript: false,
        rate_limit_per_minute: 6,
        is_active: true,
        coverage_scope: 'EUROPE',
        metadata: JSON.stringify({ phase: 1 }),
        created_at: now,
        updated_at: now,
      },
    ];

    await queryInterface.bulkInsert('sources', sources);

    const feeds = sources.map((source) => ({
      id: randomUUID(),
      source_id: source.id,
      feed_type: 'rss',
      url: source.rss_url,
      is_active: true,
      last_etag: null,
      last_modified: null,
      last_fetched_at: null,
      created_at: now,
      updated_at: now,
    }));
    await queryInterface.bulkInsert('source_feeds', feeds);

    const health = sources.map((source) => ({
      source_id: source.id,
      status: 'unknown',
      last_success_at: null,
      last_error_at: null,
      consecutive_failures: 0,
      last_error_message: null,
      updated_at: now,
    }));
    await queryInterface.bulkInsert('source_health', health);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM sources WHERE slug IN ('bbc-football', 'guardian-football')`,
    );
  },
};
