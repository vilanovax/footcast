export type EvaluationRow = {
  verdict: string;
  expectedRelationship: string;
  predictedRelationship?: string | null;
};

export function computeEvaluationMetrics(rows: EvaluationRow[]) {
  const total = rows.length;
  const byVerdict: Record<string, number> = {};
  const byExpected: Record<string, { correct: number; total: number }> = {};
  const byPredicted: Record<string, { correct: number; total: number }> = {};

  for (const row of rows) {
    byVerdict[row.verdict] = (byVerdict[row.verdict] ?? 0) + 1;
    byExpected[row.expectedRelationship] ??= { correct: 0, total: 0 };
    byExpected[row.expectedRelationship]!.total += 1;
    if (row.verdict === 'CORRECT') {
      byExpected[row.expectedRelationship]!.correct += 1;
    }
    if (row.predictedRelationship) {
      byPredicted[row.predictedRelationship] ??= { correct: 0, total: 0 };
      byPredicted[row.predictedRelationship]!.total += 1;
      if (row.verdict === 'CORRECT') {
        byPredicted[row.predictedRelationship]!.correct += 1;
      }
    }
  }

  const recall = (key: string) => {
    const b = byExpected[key];
    if (!b || b.total === 0) return null;
    return b.correct / b.total;
  };
  const precision = (key: string) => {
    const b = byPredicted[key];
    if (!b || b.total === 0) return null;
    return b.correct / b.total;
  };

  return {
    evaluatedCount: total,
    byVerdict,
    exactDuplicatePrecision: precision('EXACT_DUPLICATE'),
    exactDuplicateRecall: recall('EXACT_DUPLICATE'),
    nearDuplicatePrecision: precision('NEAR_DUPLICATE'),
    nearDuplicateRecall: recall('NEAR_DUPLICATE'),
    sameEventPrecision: precision('SAME_EVENT'),
    sameEventRecall: recall('SAME_EVENT'),
    newDevelopmentPrecision: precision('NEW_DEVELOPMENT'),
    newDevelopmentRecall: recall('NEW_DEVELOPMENT'),
    falseMergeRate: (byVerdict.WRONG_MERGE ?? 0) / Math.max(1, total),
    missedMergeRate: (byVerdict.MISSED_MERGE ?? 0) / Math.max(1, total),
    wrongRelationshipRate: (byVerdict.WRONG_RELATIONSHIP ?? 0) / Math.max(1, total),
  };
}
