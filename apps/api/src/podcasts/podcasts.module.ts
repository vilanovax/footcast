import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import {
  PodcastsController,
  PodcastsPublicController,
} from './podcasts.controller.js';
import { PodcastsService } from './podcasts.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PodcastsPublicController, PodcastsController],
  providers: [PodcastsService],
})
export class PodcastsModule {}
