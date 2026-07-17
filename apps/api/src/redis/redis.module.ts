import { Global, Module, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { getConfig } from '@footcast/config';
import { REDIS_TOKEN } from './redis.tokens.js';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_TOKEN,
      useFactory: (): Redis => new Redis(getConfig().REDIS_URL, { maxRetriesPerRequest: 1 }),
    },
  ],
  exports: [REDIS_TOKEN],
})
export class RedisModule implements OnModuleDestroy {
  constructor() {}

  async onModuleDestroy(): Promise<void> {
    // Redis instance closed by Nest DI lifecycle consumers if needed
  }
}
