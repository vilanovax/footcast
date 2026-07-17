import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  contentFingerprint,
  cosineSimilarity,
  decideClusterAction,
  mockEmbed,
  titleSimilarity,
} from './index.js';

describe('titleSimilarity', () => {
  it('scores near-identical titles high', () => {
    const score = titleSimilarity(
      'استقلال مهاجم جدید جذب کرد',
      'استقلال مهاجم جدید را جذب کرد',
    );
    assert.ok(score >= 0.6);
  });
});

describe('mockEmbed', () => {
  it('is deterministic and similar for close texts', () => {
    const a = mockEmbed('Liverpool sign midfielder in Premier League transfer');
    const b = mockEmbed('Liverpool signs a midfielder — Premier League transfer news');
    const c = mockEmbed('Perspolis coach resigns after derby loss in Tehran');
    assert.equal(a.length, 256);
    assert.ok(cosineSimilarity(a, b) > cosineSimilarity(a, c));
    assert.deepEqual(a, mockEmbed('Liverpool sign midfielder in Premier League transfer'));
  });
});

describe('contentFingerprint', () => {
  it('matches normalized duplicates', () => {
    const left = contentFingerprint(['Title One', 'Summary body']);
    const right = contentFingerprint([' title one ', 'Summary   body']);
    assert.equal(left, right);
  });
});

describe('decideClusterAction', () => {
  it('merges on content hash', () => {
    const decision = decideClusterAction([
      {
        eventId: 'e1',
        articleId: 'a1',
        contentHashMatch: true,
        titleSimilarity: 0.2,
        entityOverlap: 0,
        embeddingSimilarity: 0.2,
        sameCategory: true,
        withinTimeWindow: true,
      },
    ]);
    assert.equal(decision.kind, 'merge');
    assert.equal(decision.method, 'content_hash');
  });

  it('creates when weak similarity', () => {
    const decision = decideClusterAction([
      {
        eventId: 'e1',
        articleId: 'a1',
        contentHashMatch: false,
        titleSimilarity: 0.2,
        entityOverlap: 0,
        embeddingSimilarity: 0.3,
        sameCategory: false,
        withinTimeWindow: true,
      },
    ]);
    assert.equal(decision.kind, 'create');
  });

  it('flags conflict on mid similarity', () => {
    const decision = decideClusterAction([
      {
        eventId: 'e1',
        articleId: 'a1',
        contentHashMatch: false,
        titleSimilarity: 0.75,
        entityOverlap: 0.2,
        embeddingSimilarity: 0.8,
        sameCategory: true,
        withinTimeWindow: true,
      },
    ]);
    assert.equal(decision.kind, 'conflict');
  });
});
