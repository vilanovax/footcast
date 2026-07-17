import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { ReportsService } from './reports.service.js';

class DaysQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number;
}

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @RequirePermissions('dashboard:read')
  overview(@Query() query: DaysQueryDto) {
    return this.reportsService.overview(query.days ?? 7);
  }

  @Get('models')
  @RequirePermissions('dashboard:read')
  models(@Query() query: DaysQueryDto) {
    return this.reportsService.modelPerformance(query.days ?? 7);
  }

  @Get('sources')
  @RequirePermissions('dashboard:read')
  sources(@Query() query: DaysQueryDto) {
    return this.reportsService.sourcePerformance(query.days ?? 7);
  }

  @Get('editorial')
  @RequirePermissions('dashboard:read')
  editorial(@Query() query: DaysQueryDto) {
    return this.reportsService.editorialAcceptance(query.days ?? 7);
  }
}
