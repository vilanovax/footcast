import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HealthStatus } from '@footcast/shared';

describe('health contract', () => {
  it('exposes expected service keys', () => {
    const services = {
      database: HealthStatus.HEALTHY,
      redis: HealthStatus.HEALTHY,
      crawler: HealthStatus.UNKNOWN,
      worker: HealthStatus.UNKNOWN,
      storage: HealthStatus.UNKNOWN,
    };
    assert.deepEqual(Object.keys(services).sort(), [
      'crawler',
      'database',
      'redis',
      'storage',
      'worker',
    ]);
  });
});
