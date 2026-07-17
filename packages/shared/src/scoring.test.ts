import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeImportanceScore } from './scoring.js';

describe('computeImportanceScore', () => {
  it('returns high score for strong official news', () => {
    const score = computeImportanceScore({
      sportingImpact: 90,
      teamOrPlayerImportance: 85,
      sourceCredibility: 95,
      freshness: 90,
      officialness: 100,
      nationalOrInternationalImpact: 80,
      independentSourceCount: 70,
      podcastFitness: 85,
    });
    assert.ok(score >= 85);
  });

  it('applies duplicate and rumor penalties', () => {
    const base = computeImportanceScore({
      sportingImpact: 70,
      teamOrPlayerImportance: 70,
      sourceCredibility: 60,
      freshness: 80,
      officialness: 40,
      nationalOrInternationalImpact: 50,
      independentSourceCount: 20,
      podcastFitness: 60,
    });
    const penalized = computeImportanceScore(
      {
        sportingImpact: 70,
        teamOrPlayerImportance: 70,
        sourceCredibility: 60,
        freshness: 80,
        officialness: 40,
        nationalOrInternationalImpact: 50,
        independentSourceCount: 20,
        podcastFitness: 60,
      },
      { duplicate: 40, singleSourceRumor: 25 },
    );
    assert.ok(penalized < base);
    assert.equal(penalized, Math.max(0, base - 65));
  });
});
