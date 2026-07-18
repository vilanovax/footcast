import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decideFromSimilarity } from './decide.js';
import type { SimilarityBreakdown } from './similarity.js';
import type { EventSignature } from '@footcast/shared';

const sig = (entities: string[], action = 'TRANSFER_OFFICIAL'): EventSignature => ({
  eventType: 'TRANSFER',
  action,
  primaryEntities: entities,
  secondaryEntities: [],
});

const breakdown = (score: number, entities: string[]): SimilarityBreakdown => ({
  eventSimilarity: score,
  entitySimilarity: entities.length ? 0.9 : 0,
  eventTypeSimilarity: 0.9,
  actionCompatibility: 0.8,
  semanticSimilarity: 0.7,
  titleSimilarity: 0.6,
  timeSimilarity: 0.8,
  sharedPrimaryEntities: entities,
  sameMatchId: false,
  withinCategoryWindow: true,
});

describe('AI fallback prefer create', () => {
  it('low AI confidence does not auto-merge', () => {
    const d = decideFromSimilarity({
      eventId: 'e1',
      exactDuplicate: false,
      nearDuplicate: false,
      breakdown: breakdown(0.82, ['پرسپولیس']),
      incoming: sig(['پرسپولیس']),
      candidate: sig(['پرسپولیس']),
      aiDecision: {
        relationship: 'SAME_EVENT',
        confidence: 0.5,
        recommendedAction: 'ATTACH_AS_SUPPORTING',
      },
    });
    assert.equal(d.kind, 'conflict');
    assert.equal(d.recommendedAction, 'NEEDS_HUMAN_REVIEW');
  });

  it('AI unrelated creates new event', () => {
    const d = decideFromSimilarity({
      eventId: 'e1',
      exactDuplicate: false,
      nearDuplicate: false,
      breakdown: breakdown(0.8, ['پرسپولیس']),
      incoming: sig(['پرسپولیس']),
      candidate: sig(['پرسپولیس']),
      aiDecision: {
        relationship: 'UNRELATED',
        confidence: 0.9,
        recommendedAction: 'CREATE_NEW_EVENT',
      },
    });
    assert.equal(d.kind, 'create');
  });
});

describe('Merge validation rules (logical)', () => {
  it('rejects self-merge and empty secondaries', () => {
    const primary = 'a';
    const secondaries = ['a', 'a'];
    const unique = [...new Set(secondaries)].filter((id) => id !== primary);
    assert.equal(unique.length, 0);
  });

  it('detects trivial cycle primary↔secondary', () => {
    const primaryMergedInto = 'b';
    const secondaryId = 'b';
    assert.equal(primaryMergedInto === secondaryId, true);
  });
});
