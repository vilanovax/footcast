'use strict';

const { randomUUID } = require('crypto');

/**
 * Point IRNA at sports RSS (tp/14) and add Iran football-friendly sources.
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const sportsRss = 'https://www.irna.ir/rss/tp/14';

    await queryInterface.sequelize.query(
      `UPDATE sources
       SET name = 'IRNA Sports',
           rss_url = :rss,
           metadata = COALESCE(metadata, '{}'::jsonb) || '{"section":"sport"}'::jsonb,
           updated_at = :now
       WHERE slug = 'irna-sports-sample'`,
      { replacements: { rss: sportsRss, now } },
    );

    await queryInterface.sequelize.query(
      `UPDATE source_feeds AS f
       SET url = :rss, updated_at = :now
       FROM sources s
       WHERE f.source_id = s.id
         AND s.slug = 'irna-sports-sample'
         AND f.feed_type = 'rss'`,
      { replacements: { rss: sportsRss, now } },
    );

    // Archive junk already in inbox (politics / non-football titles)
    await queryInterface.sequelize.query(
      `UPDATE news_events
       SET status = 'ARCHIVED', updated_at = :now
       WHERE status IN ('NEW', 'NEEDS_REVIEW', 'VERIFIED', 'CONFLICTED')
         AND (
           title ~* '(تنگه هرمز|جبهه مقاومت|رهبر|انقلاب|قوه|مجلس|وزیر خارجه|تحریم|دیپلماسی)'
           OR (
             title !~* '(فوتبال|باشگاه|لیگ|استقلال|پرسپولیس|سپاهان|تراکتور|سرمربی|نقل و انتقال|transfer|football|soccer|premier|messi|ronaldo|liverpool|arsenal|chelsea|madrid|barcelona)'
             AND category = 'OTHER'
           )
           OR title ~* '(بسکتبال|والیبال|کشتی|وزنه‌برداری|تکواندو)'
         )`,
      { replacements: { now } },
    );
  },

  async down(queryInterface) {
    const now = new Date();
    const oldRss = 'https://www.irna.ir/rss';
    await queryInterface.sequelize.query(
      `UPDATE sources SET rss_url = :rss, updated_at = :now WHERE slug = 'irna-sports-sample'`,
      { replacements: { rss: oldRss, now } },
    );
  },
};
