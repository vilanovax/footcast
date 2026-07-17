import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertSafeUrl } from './safe-fetch.js';

describe('assertSafeUrl', () => {
  it('allows public https urls', async () => {
    const url = await assertSafeUrl('https://example.com/path');
    assert.equal(url.hostname, 'example.com');
  });

  it('blocks localhost', async () => {
    await assert.rejects(() => assertSafeUrl('http://localhost/admin'), /Blocked host|Private/);
  });

  it('blocks private ipv4 literals', async () => {
    await assert.rejects(() => assertSafeUrl('http://127.0.0.1/x'), /Private/);
    await assert.rejects(() => assertSafeUrl('http://192.168.1.1/x'), /Private/);
  });
});
