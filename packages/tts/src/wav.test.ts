import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MockTtsProvider } from './mock-provider.js';
import { buildPodcastRss } from './rss.js';
import { buildToneWav } from './wav.js';

describe('buildToneWav', () => {
  it('creates a valid RIFF/WAVE header', () => {
    const wav = buildToneWav({ durationSec: 1 });
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.ok(wav.length > 1000);
  });
});

describe('MockTtsProvider', () => {
  it('returns playable wav bytes', async () => {
    const provider = new MockTtsProvider();
    const result = await provider.synthesize({
      text: 'سلام این یک تست پادکست است '.repeat(40),
      targetDurationSec: 600,
    });
    assert.equal(result.provider, 'mock');
    assert.equal(result.mimeType, 'audio/wav');
    assert.equal(result.audioBuffer.toString('ascii', 0, 4), 'RIFF');
    assert.ok(result.reportedDurationSec >= 30);
  });
});

describe('buildPodcastRss', () => {
  it('includes enclosure and itunes duration', () => {
    const xml = buildPodcastRss({
      channelTitle: 'اتاق خبر فوتبال',
      channelDescription: 'خلاصه خبر',
      channelLink: 'http://localhost:3000',
      items: [
        {
          title: 'اپیزود ۱',
          description: 'تست',
          audioUrl: 'http://localhost:3001/api/v1/podcasts/x/audio/file',
          durationSec: 615,
          pubDate: new Date('2026-07-17T12:00:00Z'),
          guid: 'ep-1',
          fileSizeBytes: 1000,
        },
      ],
    });
    assert.ok(xml.includes('<enclosure'));
    assert.ok(xml.includes('itunes:duration'));
    assert.ok(xml.includes('اپیزود ۱'));
  });
});
