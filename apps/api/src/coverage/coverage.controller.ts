import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { CoverageService } from './coverage.service.js';

@ApiTags('coverage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('editorial')
export class CoverageController {
  constructor(private readonly coverage: CoverageService) {}

  @Get('days/:editorialDate/coverage')
  @RequirePermissions('editorial:read')
  byDay(
    @Param('editorialDate') editorialDate: string,
    @Query('backfill') backfill?: string,
  ) {
    return this.coverage.coverageForEditorialDate(editorialDate, {
      backfill: backfill !== '0' && backfill !== 'false',
    });
  }

  @Get('coverage/today')
  @RequirePermissions('editorial:read')
  today(@Query('backfill') backfill?: string) {
    return this.coverage.coverageForEditorialDate(undefined, {
      backfill: backfill !== '0' && backfill !== 'false',
    });
  }

  @Get('rundowns/:rundownId/coverage')
  @RequirePermissions('editorial:read')
  byRundown(@Param('rundownId', ParseUUIDPipe) rundownId: string) {
    return this.coverage.coverageForRundown(rundownId);
  }
}
