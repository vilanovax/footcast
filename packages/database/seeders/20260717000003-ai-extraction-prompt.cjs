'use strict';

const { randomUUID } = require('crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      `SELECT id FROM prompt_templates WHERE name = 'article_extraction' LIMIT 1`,
    );
    const templateId = existing[0]?.id ?? randomUUID();

    if (!existing[0]) {
      await queryInterface.bulkInsert('prompt_templates', [
        {
          id: templateId,
          name: 'article_extraction',
          pipeline_stage: 'article_extraction',
          description: 'Extract structured football news card from parsed article text',
          created_at: now,
          updated_at: now,
        },
      ]);
    }

    const [versions] = await queryInterface.sequelize.query(
      `SELECT id FROM prompt_versions WHERE template_id = :templateId AND version = 1 LIMIT 1`,
      { replacements: { templateId } },
    );
    if (versions[0]) {
      return;
    }

    await queryInterface.bulkInsert('prompt_versions', [
      {
        id: randomUUID(),
        template_id: templateId,
        version: 1,
        provider: 'mock',
        model: 'mock-v1',
        system_prompt:
          'You are a football news extractor. Return ONLY valid JSON matching the schema. Do not invent facts beyond the article text. Prefer Persian headlines/summaries when the article is Persian.',
        user_prompt_template:
          'Article ID: {{articleId}}\nSource: {{sourceName}}\nURL: {{sourceUrl}}\nTitle: {{title}}\n\nArticle text:\n{{textContent}}\n\nExtract the news card JSON.',
        json_schema: JSON.stringify({ type: 'object' }),
        temperature: 0.2,
        max_tokens: 2000,
        is_active: true,
        created_by: 'seed',
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM prompt_templates WHERE name = 'article_extraction'`,
    );
  },
};
