'use strict';

async function addColumnIfMissing(queryInterface, table, column, spec) {
  const desc = await queryInterface.describeTable(table);
  if (!desc[column]) {
    await queryInterface.addColumn(table, column, spec);
  }
}

async function addIndexSafe(queryInterface, table, fields) {
  try {
    await queryInterface.addIndex(table, fields);
  } catch (err) {
    if (!/already exists/i.test(String(err?.message ?? err))) throw err;
  }
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfMissing(queryInterface, 'news_events', 'event_action', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'news_events', 'event_signature', {
      type: Sequelize.JSONB,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'news_events', 'latest_development_summary', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'news_events', 'independent_source_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });

    await addColumnIfMissing(queryInterface, 'news_event_articles', 'relationship_decision', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'news_event_articles', 'similarity_breakdown', {
      type: Sequelize.JSONB,
      allowNull: true,
    });

    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name));
    if (!names.includes('event_timeline_items')) {
      await queryInterface.createTable('event_timeline_items', {
        id: { type: Sequelize.UUID, primaryKey: true },
        news_event_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'news_events', key: 'id' },
          onDelete: 'CASCADE',
        },
        raw_article_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'raw_articles', key: 'id' },
          onDelete: 'SET NULL',
        },
        source_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'sources', key: 'id' },
          onDelete: 'SET NULL',
        },
        development_type: { type: Sequelize.STRING(64), allowNull: false },
        action: { type: Sequelize.STRING(64), allowNull: true },
        summary: { type: Sequelize.TEXT, allowNull: false },
        occurred_at: { type: Sequelize.DATE, allowNull: true },
        published_at: { type: Sequelize.DATE, allowNull: true },
        is_major_development: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
    }

    await addIndexSafe(queryInterface, 'event_timeline_items', ['news_event_id']);
    await addIndexSafe(queryInterface, 'event_timeline_items', ['news_event_id', 'occurred_at']);
    await addIndexSafe(queryInterface, 'news_events', ['event_action']);

    // Normalize legacy roles to uppercase operational roles
    await queryInterface.sequelize.query(`
      UPDATE news_event_articles
      SET role = CASE lower(role)
        WHEN 'primary' THEN 'PRIMARY'
        WHEN 'duplicate' THEN 'NEAR_DUPLICATE'
        WHEN 'related' THEN 'BACKGROUND'
        ELSE upper(role)
      END
      WHERE role IS NOT NULL
        AND role <> upper(role)
    `);

    await queryInterface.sequelize.query(`
      UPDATE news_events ne
      SET independent_source_count = GREATEST(1, (
        SELECT COUNT(DISTINCT ra.source_id)
        FROM news_event_articles nea
        JOIN raw_articles ra ON ra.id = nea.article_id
        WHERE nea.event_id = ne.id
          AND nea.role IN ('PRIMARY', 'SUPPORTING', 'NEW_DEVELOPMENT', 'CONFLICTING')
      ))
    `);
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name));
    if (names.includes('event_timeline_items')) {
      await queryInterface.dropTable('event_timeline_items');
    }
    const eventCols = await queryInterface.describeTable('news_events');
    for (const col of [
      'event_action',
      'event_signature',
      'latest_development_summary',
      'independent_source_count',
    ]) {
      if (eventCols[col]) await queryInterface.removeColumn('news_events', col);
    }
    const linkCols = await queryInterface.describeTable('news_event_articles');
    for (const col of ['relationship_decision', 'similarity_breakdown']) {
      if (linkCols[col]) await queryInterface.removeColumn('news_event_articles', col);
    }
  },
};
