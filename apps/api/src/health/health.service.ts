import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { HealthStatus } from '@footcast/shared';
import type { Database } from '@footcast/database';
import { DATABASE_TOKEN } from '../database/database.tokens.js';
import { REDIS_TOKEN } from '../redis/redis.tokens.js';

export interface HealthReport {
  status: HealthStatus;
  timestamp: string;
  services: Record<string, HealthStatus>;
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    @Inject(REDIS_TOKEN) private readonly redis: Redis,
  ) {}

  async check(): Promise<HealthReport> {
    const services: Record<string, HealthStatus> = {
      database: HealthStatus.UNKNOWN,
      redis: HealthStatus.UNKNOWN,
      crawler: HealthStatus.UNKNOWN,
      worker: HealthStatus.UNKNOWN,
      storage: HealthStatus.UNKNOWN,
    };

    try {
      await this.db.sequelize.authenticate();
      services.database = HealthStatus.HEALTHY;
    } catch {
      services.database = HealthStatus.DOWN;
    }

    try {
      const pong = await this.redis.ping();
      services.redis = pong === 'PONG' ? HealthStatus.HEALTHY : HealthStatus.DEGRADED;
    } catch {
      services.redis = HealthStatus.DOWN;
    }

    const criticalDown =
      services.database === HealthStatus.DOWN || services.redis === HealthStatus.DOWN;
    const status = criticalDown ? HealthStatus.DOWN : HealthStatus.HEALTHY;

    return {
      status,
      timestamp: new Date().toISOString(),
      services,
    };
  }

  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  async ready(): Promise<{ status: 'ready' | 'not_ready'; details: Record<string, HealthStatus> }> {
    const report = await this.check();
    const ready =
      report.services.database === HealthStatus.HEALTHY &&
      report.services.redis === HealthStatus.HEALTHY;
    return {
      status: ready ? 'ready' : 'not_ready',
      details: {
        database: report.services.database,
        redis: report.services.redis,
      },
    };
  }
}
