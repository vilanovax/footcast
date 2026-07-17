import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthStatus } from '@footcast/shared';
import { HealthService } from './health.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async health() {
    const report = await this.healthService.check();
    if (report.status === HealthStatus.DOWN) {
      throw new ServiceUnavailableException(report);
    }
    return report;
  }

  @Get('live')
  live() {
    return this.healthService.live();
  }

  @Get('ready')
  async ready() {
    const report = await this.healthService.ready();
    if (report.status !== 'ready') {
      throw new ServiceUnavailableException(report);
    }
    return report;
  }
}
