'use strict';

async function addColumnIfMissing(queryInterface, table, column, spec) {
  const desc = await queryInterface.describeTable(table);
  if (!desc[column]) {
    await queryInterface.addColumn(table, column, spec);
  }
}

async function addIndexSafe(queryInterface, table, fields, options = {}) {
  try {
    await queryInterface.addIndex(table, fields, options);
  } catch (err) {
    const msg = String(err?.message ?? err);
    if (!/already exists/i.test(msg)) throw err;
  }
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfMissing(queryInterface, 'editorial_scores', 'credibility_score', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'editorial_scores', 'importance_score', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'editorial_scores', 'podcast_value_score', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'editorial_scores', 'raw_final_score', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'editorial_scores', 'total_bonus', {
      type: Sequelize.FLOAT,
      allowNull: false,
      defaultValue: 0,
    });
    await addColumnIfMissing(queryInterface, 'editorial_scores', 'total_penalty', {
      type: Sequelize.FLOAT,
      allowNull: false,
      defaultValue: 0,
    });
    await addColumnIfMissing(queryInterface, 'editorial_scores', 'recommendation', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'editorial_scores', 'reasons', {
      type: Sequelize.JSONB,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'editorial_scores', 'bonuses', {
      type: Sequelize.JSONB,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'editorial_scores', 'penalty_items', {
      type: Sequelize.JSONB,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'editorial_scores', 'input_snapshot', {
      type: Sequelize.JSONB,
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, 'news_events', 'podcast_value_score', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'news_events', 'effective_final_score', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'news_events', 'recommendation', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });

    const tables = await queryInterface.showAllTables();
    const tableNames = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name));
    if (!tableNames.includes('editorial_score_overrides')) {
      await queryInterface.createTable('editorial_score_overrides', {
        id: { type: Sequelize.UUID, primaryKey: true },
        news_event_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'news_events', key: 'id' },
          onDelete: 'CASCADE',
        },
        automatic_final_score: { type: Sequelize.FLOAT, allowNull: false },
        overridden_final_score: { type: Sequelize.FLOAT, allowNull: false },
        reason: { type: Sequelize.TEXT, allowNull: false },
        user_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },
        created_at: { type: Sequelize.DATE, allowNull: false },
        revoked_at: { type: Sequelize.DATE, allowNull: true },
      });
    }

    await addIndexSafe(queryInterface, 'editorial_score_overrides', ['news_event_id']);
    await addIndexSafe(queryInterface, 'editorial_score_overrides', [
      'news_event_id',
      'revoked_at',
    ]);
    await addIndexSafe(queryInterface, 'news_event_articles', ['event_id', 'article_id']);
    await addIndexSafe(queryInterface, 'raw_articles', ['source_id']);
    await addIndexSafe(queryInterface, 'news_events', ['effective_final_score']);
    await addIndexSafe(queryInterface, 'news_events', ['recommendation']);
    await addIndexSafe(queryInterface, 'news_events', ['credibility_score']);

    await queryInterface.sequelize.query(`
      UPDATE news_events
      SET effective_final_score = importance_score
      WHERE importance_score IS NOT NULL AND effective_final_score IS NULL
    `);

    await queryInterface.sequelize.query(`
      UPDATE editorial_scores
      SET
        credibility_score = COALESCE(
          NULLIF((factors->>'sourceCredibility')::float, 0),
          LEAST(100, GREATEST(0, final_score::float * 0.9))
        ),
        importance_score = COALESCE(
          NULLIF((factors->>'sportingImpact')::float, 0),
          final_score::float
        ),
        podcast_value_score = COALESCE(
          NULLIF((factors->>'podcastFitness')::float, 0),
          50
        ),
        raw_final_score = final_score::float,
        reasons = COALESCE(reasons, '[]'::jsonb),
        bonuses = COALESCE(bonuses, '[]'::jsonb),
        penalty_items = COALESCE(penalty_items, '[]'::jsonb)
      WHERE credibility_score IS NULL
    `);

    await queryInterface.sequelize.query(`
      UPDATE news_events
      SET recommendation = CASE
        WHEN COALESCE(effective_final_score, importance_score) >= 85 THEN 'LEAD_STORY'
        WHEN COALESCE(effective_final_score, importance_score) >= 70 THEN 'INCLUDE_IN_MAIN_PODCAST'
        WHEN COALESCE(effective_final_score, importance_score) >= 60 THEN 'INCLUDE_AS_BRIEF'
        WHEN COALESCE(effective_final_score, importance_score) >= 45 THEN 'NEEDS_EDITOR_REVIEW'
        ELSE 'REJECT_OR_ARCHIVE'
      END
      WHERE recommendation IS NULL
        AND COALESCE(effective_final_score, importance_score) IS NOT NULL
    `);
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const tableNames = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name));
    if (tableNames.includes('editorial_score_overrides')) {
      await queryInterface.dropTable('editorial_score_overrides');
    }
    const newsCols = await queryInterface.describeTable('news_events');
    for (const col of ['recommendation', 'effective_final_score', 'podcast_value_score']) {
      if (newsCols[col]) await queryInterface.removeColumn('news_events', col);
    }
    const scoreCols = await queryInterface.describeTable('editorial_scores');
    for (const col of [
      'credibility_score',
      'importance_score',
      'podcast_value_score',
      'raw_final_score',
      'total_bonus',
      'total_penalty',
      'recommendation',
      'reasons',
      'bonuses',
      'penalty_items',
      'input_snapshot',
    ]) {
      if (scoreCols[col]) await queryInterface.removeColumn('editorial_scores', col);
    }
  },
};
