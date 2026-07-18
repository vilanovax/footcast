import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module.js';
import { RedisModule } from './redis/redis.module.js';
import { QueueModule } from './queue/queue.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { RolesModule } from './roles/roles.module.js';
import { SourcesModule } from './sources/sources.module.js';
import { ArticlesModule } from './articles/articles.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { AiModule } from './ai/ai.module.js';
import { EventsModule } from './events/events.module.js';
import { EditorialModule } from './editorial/editorial.module.js';
import { PodcastsModule } from './podcasts/podcasts.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { ClusteringModule } from './clustering/clustering.module.js';
import { RundownModule } from './rundown/rundown.module.js';
import { CoverageModule } from './coverage/coverage.module.js';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    QueueModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    SourcesModule,
    ArticlesModule,
    SettingsModule,
    DashboardModule,
    AiModule,
    EventsModule,
    EditorialModule,
    PodcastsModule,
    ReportsModule,
    NotificationsModule,
    ClusteringModule,
    RundownModule,
    CoverageModule,
  ],
})
export class AppModule {}
