import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ClusteringController } from './clustering.controller.js';
import { ClusteringService } from './clustering.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ClusteringController],
  providers: [ClusteringService],
  exports: [ClusteringService],
})
export class ClusteringModule {}
