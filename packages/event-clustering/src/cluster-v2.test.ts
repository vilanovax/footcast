import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CLUSTER_THRESHOLDS,
  NewsCategory,
  decisionToStoredRole,
  normalizeEventArticleRole,
} from '@footcast/shared';
import {
  MockClusterAiJudge,
  buildEventSignatureFromCard,
  computeEventSimilarity,
  decideFromSimilarity,
  inferActionFromText,
  isNearDuplicate,
  mockEmbed,
  titleSimilarity,
} from './index.js';

describe('event signature', () => {
  it('infers transfer actions from text', () => {
    assert.equal(
      inferActionFromText(NewsCategory.TRANSFER, 'مذاکرات استقلال برای جذب مهاجم'),
      'NEGOTIATION_STARTED',
    );
    assert.equal(
      inferActionFromText(NewsCategory.TRANSFER, 'پیشنهاد باشگاه ارسال شد'),
      'OFFER_SUBMITTED',
    );
    assert.equal(
      inferActionFromText(NewsCategory.TRANSFER, 'انتقال به‌صورت رسمی اعلام شد'),
      'TRANSFER_OFFICIAL',
    );
  });

  it('builds signature from card with normalized entity names', () => {
    const sig = buildEventSignatureFromCard({
      category: NewsCategory.TRANSFER,
      headlineFa: 'مذاکرات لیورپول برای جذب بازیکن X',
      summaryFa: 'باشگاه وارد مذاکره شده است',
      clubs: [{ name: 'Liverpool' }, { name: 'Newcastle' }],
      people: [{ name: 'Player X' }],
      action: 'NEGOTIATION_STARTED',
    });
    assert.equal(sig.eventType, NewsCategory.TRANSFER);
    assert.equal(sig.action, 'NEGOTIATION_STARTED');
    assert.ok(sig.primaryEntities.includes('player x'));
    assert.ok(sig.primaryEntities.includes('liverpool'));
  });
});

describe('near duplicate', () => {
  it('detects near-identical republish', () => {
    const result = isNearDuplicate({
      titleA: 'استقلال مهاجم جدید جذب کرد',
      titleB: 'استقلال مهاجم جدید را جذب کرد',
      contentPartsA: ['استقلال مهاجم جدید جذب کرد', 'باشگاه خبر داد'],
      contentPartsB: ['استقلال مهاجم جدید جذب کرد', 'باشگاه خبر داد'],
      claimsA: ['استقلال مهاجم جذب کرد'],
      claimsB: ['استقلال مهاجم جذب کرد'],
      entityOverlap: 1,
    });
    assert.equal(result.isNear, true);
  });
});

describe('similarity + decide', () => {
  const negotiation = {
    eventType: NewsCategory.TRANSFER,
    action: 'NEGOTIATION_STARTED',
    primaryEntities: ['player x', 'liverpool'],
    secondaryEntities: ['newcastle'],
    occurredAt: '2026-07-18T08:00:00Z',
  };
  const offer = {
    ...negotiation,
    action: 'OFFER_SUBMITTED',
    occurredAt: '2026-07-18T18:00:00Z',
  };
  const otherTransfer = {
    eventType: NewsCategory.TRANSFER,
    action: 'NEGOTIATION_STARTED',
    primaryEntities: ['player y', 'arsenal'],
    secondaryEntities: [],
    occurredAt: '2026-07-18T09:00:00Z',
  };

  it('scores progression higher as same event family', () => {
    const emb = mockEmbed('liverpool player x transfer negotiation');
    const breakdown = computeEventSimilarity({
      incoming: offer,
      candidate: negotiation,
      titleA: 'لیورپول پیشنهاد رسمی داد',
      titleB: 'لیورپول وارد مذاکره شد',
      embeddingA: emb,
      embeddingB: emb,
      claimsA: ['پیشنهاد رسمی'],
      claimsB: ['مذاکره شروع شد'],
    });
    assert.ok(breakdown.sharedPrimaryEntities.length >= 1);
    assert.ok(breakdown.actionCompatibility >= 0.65);
    assert.ok(breakdown.eventSimilarity >= 0.55);
  });

  it('auto-attaches new development on high similarity progression', () => {
    const emb = mockEmbed('liverpool player x transfer offer official');
    const breakdown = computeEventSimilarity({
      incoming: offer,
      candidate: negotiation,
      titleA: 'پیشنهاد رسمی لیورپول برای بازیکن X',
      titleB: 'مذاکرات لیورپول برای بازیکن X',
      embeddingA: emb,
      embeddingB: emb,
      claimsA: ['پیشنهاد رسمی ارسال شد'],
      claimsB: ['مذاکرات آغاز شد'],
    });
    // Force high score band for deterministic unit test
    const boosted = { ...breakdown, eventSimilarity: 0.91 };
    const decision = decideFromSimilarity({
      eventId: 'e1',
      exactDuplicate: false,
      nearDuplicate: false,
      breakdown: boosted,
      incoming: offer,
      candidate: negotiation,
    });
    assert.equal(decision.kind, 'attach');
    assert.equal(decision.relationshipDecision, 'NEW_DEVELOPMENT');
    assert.equal(decision.storedRole, 'NEW_DEVELOPMENT');
  });

  it('creates new event when no shared primary entities', () => {
    const embA = mockEmbed('liverpool player x');
    const embB = mockEmbed('arsenal player y completely different');
    const breakdown = computeEventSimilarity({
      incoming: otherTransfer,
      candidate: negotiation,
      titleA: 'آرسنال مذاکره می‌کند',
      titleB: 'لیورپول مذاکره می‌کند',
      embeddingA: embA,
      embeddingB: embB,
    });
    const decision = decideFromSimilarity({
      eventId: 'e1',
      exactDuplicate: false,
      nearDuplicate: false,
      breakdown,
      incoming: otherTransfer,
      candidate: negotiation,
    });
    assert.equal(decision.kind, 'create');
  });

  it('marks AI boundary band as needing judge', () => {
    const emb = mockEmbed('liverpool player x talks');
    const breakdown = {
      ...computeEventSimilarity({
        incoming: offer,
        candidate: negotiation,
        titleA: 'گزارش جدید',
        titleB: 'گزارش قبلی',
        embeddingA: emb,
        embeddingB: emb,
      }),
      eventSimilarity: 0.8,
      sharedPrimaryEntities: ['player x', 'liverpool'],
    };
    const decision = decideFromSimilarity({
      eventId: 'e1',
      exactDuplicate: false,
      nearDuplicate: false,
      breakdown,
      incoming: offer,
      candidate: negotiation,
    });
    assert.equal(decision.needsAiBoundary, true);
    assert.ok(
      decision.score >= CLUSTER_THRESHOLDS.aiBoundaryMin &&
        decision.score < CLUSTER_THRESHOLDS.aiBoundaryMax,
    );
  });

  it('AI mock prefers create on uncertainty', async () => {
    const judge = new MockClusterAiJudge();
    const result = await judge.judge({
      incoming: otherTransfer,
      candidate: negotiation,
      incomingHeadline: 'a',
      incomingSummary: 'b',
      candidateHeadline: 'c',
      candidateSummary: 'd',
      incomingClaims: [],
      candidateClaims: [],
      latestTimelineSummaries: [],
      breakdown: {
        entitySimilarity: 0,
        eventTypeSimilarity: 1,
        actionCompatibility: 0.5,
        semanticSimilarity: 0.4,
        titleSimilarity: 0.2,
        timeSimilarity: 0.8,
        eventSimilarity: 0.78,
        sharedPrimaryEntities: [],
        sameMatchId: false,
        withinCategoryWindow: true,
      },
    });
    assert.equal(result.relationship, 'UNRELATED');
    assert.ok(result.confidence < CLUSTER_THRESHOLDS.aiMinConfidence);
  });

  it('AI mock detects new development on action progression', async () => {
    const judge = new MockClusterAiJudge();
    const result = await judge.judge({
      incoming: offer,
      candidate: negotiation,
      incomingHeadline: 'پیشنهاد',
      incomingSummary: 'پیشنهاد رسمی',
      candidateHeadline: 'مذاکره',
      candidateSummary: 'شروع مذاکره',
      incomingClaims: ['پیشنهاد رسمی'],
      candidateClaims: ['مذاکره'],
      latestTimelineSummaries: ['مذاکرات آغاز شد'],
      breakdown: {
        entitySimilarity: 1,
        eventTypeSimilarity: 1,
        actionCompatibility: 0.8,
        semanticSimilarity: 0.85,
        titleSimilarity: 0.7,
        timeSimilarity: 0.9,
        eventSimilarity: 0.82,
        sharedPrimaryEntities: ['player x', 'liverpool'],
        sameMatchId: false,
        withinCategoryWindow: true,
      },
    });
    assert.equal(result.relationship, 'NEW_DEVELOPMENT');
    assert.ok(result.confidence >= CLUSTER_THRESHOLDS.aiMinConfidence);
  });
});

describe('role mapping', () => {
  it('maps legacy roles', () => {
    assert.equal(normalizeEventArticleRole('primary'), 'PRIMARY');
    assert.equal(normalizeEventArticleRole('duplicate'), 'NEAR_DUPLICATE');
    assert.equal(normalizeEventArticleRole('related'), 'BACKGROUND');
  });

  it('maps decisions to stored roles', () => {
    assert.equal(decisionToStoredRole('SAME_EVENT'), 'SUPPORTING');
    assert.equal(decisionToStoredRole('NEW_DEVELOPMENT'), 'NEW_DEVELOPMENT');
    assert.equal(decisionToStoredRole('EXACT_DUPLICATE'), 'EXACT_DUPLICATE');
  });
});

describe('titleSimilarity smoke', () => {
  it('still works', () => {
    assert.ok(
      titleSimilarity('استقلال مهاجم جدید جذب کرد', 'استقلال مهاجم جدید را جذب کرد') >= 0.5,
    );
  });
});
