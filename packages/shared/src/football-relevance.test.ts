import { assessFootballRelevance } from './football-relevance.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('assessFootballRelevance', () => {
  it('rejects politics without football title', () => {
    const r = assessFootballRelevance({
      title: 'وحدت جبهه مقاومت و مدیریت تنگه هرمز خطوط قرمز ایران است',
      summary: 'تهران - ایرنا - مقامات بر خطوط قرمز تأکید کردند.',
      leadText: 'لینک‌های مرتبط: آخرین نتایج لیگ برتر فوتبال و استقلال',
    });
    assert.equal(r.isFootball, false);
  });

  it('accepts football transfer headline', () => {
    const r = assessFootballRelevance({
      title: 'انتقال رسمی ستاره استقلال به سپاهان',
      summary: 'باشگاه سپاهان از جذب مهاجم آبی‌ها خبر داد.',
    });
    assert.equal(r.isFootball, true);
  });

  it('rejects basketball title', () => {
    const r = assessFootballRelevance({
      title: 'قهرمانی تریوس آکادمی در لیگ بسکتبال',
      summary: 'هفته نخست لیگ بسکتبال سه به سه.',
    });
    assert.equal(r.isFootball, false);
  });

  it('ignores football widget only in lead', () => {
    const r = assessFootballRelevance({
      title: 'ورود توده هوای خنک به زنجان',
      summary: 'اداره هواشناسی هشدار داد.',
      leadText: 'بیشتر بخوانید: نقل و انتقالات لیگ برتر فوتبال پرسپولیس',
    });
    assert.equal(r.isFootball, false);
  });
});
