import { Global, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { getConfig } from '@footcast/config';
import {
  authenticateDatabase,
  closeDatabase,
  getDatabase,
  type Database,
} from '@footcast/database';
import { createLogger } from '@footcast/logger';
import { DATABASE_TOKEN } from './database.tokens.js';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_TOKEN,
      useFactory: (): Database => getDatabase(getConfig().DATABASE_URL),
    },
  ],
  exports: [DATABASE_TOKEN],
})
export class DatabaseModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = createLogger({ service: 'api', module: 'database' });

  constructor() {}

  async onModuleInit(): Promise<void> {
    const db = getDatabase(getConfig().DATABASE_URL);
    await authenticateDatabase(db);
    this.logger.info('Database connected');
  }

  async onModuleDestroy(): Promise<void> {
    const db = getDatabase(getConfig().DATABASE_URL);
    await closeDatabase(db);
  }
}
