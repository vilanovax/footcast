import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SourcesController } from './sources.controller.js';
import { SourcesService } from './sources.service.js';

@Module({
  imports: [AuthModule],
  controllers: [SourcesController],
  providers: [SourcesService],
})
export class SourcesModule {}
