import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CoverageController } from './coverage.controller.js';
import { CoverageService } from './coverage.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CoverageController],
  providers: [CoverageService],
  exports: [CoverageService],
})
export class CoverageModule {}
