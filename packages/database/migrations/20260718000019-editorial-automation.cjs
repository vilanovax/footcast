'use strict';

async function addColumnIfMissing(qi, table, column, spec) {
  const desc = await qi.describeTable(table);
  if (!desc[column]) await qi.addColumn(table, column, spec);
}

async function addIndexSafe(qi, table, fields, options = {}) {
  try {
    await qi.addIndex(table, fields, options);
  } catch (err) {
    if (!/already exists/i.test(String(err?.message ?? err))) throw err;
  }
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name));

    if (!names.includes('editorial_automation_decisions')) {
      await queryInterface.createTable('editorial_automation_decisions', {
        id: { type: Sequelize.UUID, primaryKey: true },
        news_event_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'news_events', key: 'id' },
          onDelete: 'CASCADE',
        },
        rundown_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'daily_rundowns', key: 'id' },
          onDelete: 'SET NULL',
        },
        rundown_item_id: {
          type: Sequelize.UUID,
          allowNull: true,
        },
        decision_type: { type: Sequelize.STRING(32), allowNull: false },
        policy_version: { type: Sequelize.STRING(32), allowNull: false },
        profile_mode: { type: Sequelize.STRING(32), allowNull: false },
        score_snapshot: { type: Sequelize.JSONB, allowNull: true },
        coverage_snapshot: { type: Sequelize.JSONB, allowNull: true },
        reasons: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
        blocked_reasons: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
        executed: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        executed_at: { type: Sequelize.DATE, allowNull: true },
        reverted_at: { type: Sequelize.DATE, allowNull: true },
        reverted_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },
        created_at: { type: Sequelize.DATE, allowNull: false },
      });
    }

    await addIndexSafe(queryInterface, 'editorial_automation_decisions', [
      'news_event_id',
    ]);
    await addIndexSafe(queryInterface, 'editorial_automation_decisions', [
      'rundown_id',
    ]);
    await addIndexSafe(queryInterface, 'editorial_automation_decisions', [
      'decision_type',
    ]);
    await addIndexSafe(queryInterface, 'editorial_automation_decisions', [
      'created_at',
    ]);
    await addIndexSafe(
      queryInterface,
      'editorial_automation_decisions',
      ['news_event_id', 'decision_type', 'rundown_id'],
      { name: 'editorial_automation_decisions_event_type_rundown_idx' },
    );

    const tablesAfter = await queryInterface.showAllTables();
    const namesAfter = tablesAfter.map((t) =>
      typeof t === 'string' ? t : t.tableName || t.name,
    );
    if (namesAfter.includes('daily_rundown_items')) {
      await addColumnIfMissing(queryInterface, 'daily_rundown_items', 'added_mode', {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'MANUAL',
      });
      await addColumnIfMissing(
        queryInterface,
        'daily_rundown_items',
        'automation_decision_id',
        {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'editorial_automation_decisions', key: 'id' },
          onDelete: 'SET NULL',
        },
      );
      await addColumnIfMissing(queryInterface, 'daily_rundown_items', 'review_status', {
        type: Sequelize.STRING(32),
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, 'daily_rundown_items', 'reviewed_by', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      });
      await addColumnIfMissing(queryInterface, 'daily_rundown_items', 'reviewed_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
      await addColumnIfMissing(
        queryInterface,
        'daily_rundown_items',
        'automation_reason',
        { type: Sequelize.TEXT, allowNull: true },
      );
      await addColumnIfMissing(queryInterface, 'daily_rundown_items', 'score_snapshot', {
        type: Sequelize.JSONB,
        allowNull: true,
      });

      await addIndexSafe(queryInterface, 'daily_rundown_items', ['added_mode']);
      await addIndexSafe(queryInterface, 'daily_rundown_items', [
        'automation_decision_id',
      ]);
      await addIndexSafe(queryInterface, 'daily_rundown_items', ['review_status']);
    }

    // Optional FK from decision → item (added after item columns exist)
    try {
      await queryInterface.addConstraint('editorial_automation_decisions', {
        fields: ['rundown_item_id'],
        type: 'foreign key',
        name: 'editorial_automation_decisions_rundown_item_id_fkey',
        references: { table: 'daily_rundown_items', field: 'id' },
        onDelete: 'SET NULL',
      });
    } catch (err) {
      if (!/already exists|duplicate/i.test(String(err?.message ?? err))) {
        // table may be empty / constraint unsupported in some envs — non-fatal if column exists
        if (!/does not exist/i.test(String(err?.message ?? err))) throw err;
      }
    }
  },

  async down(queryInterface) {
    const desc = await queryInterface.describeTable('daily_rundown_items').catch(() => null);
    if (desc) {
      for (const col of [
        'score_snapshot',
        'automation_reason',
        'reviewed_at',
        'reviewed_by',
        'review_status',
        'automation_decision_id',
        'added_mode',
      ]) {
        if (desc[col]) await queryInterface.removeColumn('daily_rundown_items', col);
      }
    }
    await queryInterface.dropTable('editorial_automation_decisions');
  },
};
