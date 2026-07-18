import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RundownController, WavesController } from './rundown.controller.js';
import { RundownService } from './rundown.service.js';

@Module({
  imports: [AuthModule],
  controllers: [WavesController, RundownController],
  providers: [RundownService],
  exports: [RundownService],
})
export class RundownModule {}
