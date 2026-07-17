import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { CoverageScope, SourceType } from '@footcast/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { SourcesService } from './sources.service.js';

class CreateSourceDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  slug!: string;

  @IsEnum(SourceType)
  sourceType!: SourceType;

  @IsOptional()
  @IsString()
  countryCode?: string | null;

  @IsOptional()
  @IsString()
  language?: 'fa' | 'en';

  @IsUrl()
  baseUrl!: string;

  @IsOptional()
  @IsUrl()
  rssUrl?: string | null;

  @IsOptional()
  @IsUrl()
  sitemapUrl?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  credibilitySeed?: number;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsInt()
  @Min(60)
  fetchIntervalSec?: number;

  @IsOptional()
  @IsBoolean()
  requiresJavascript?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  rateLimitPerMinute?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(CoverageScope)
  coverageScope?: CoverageScope;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

class UpdateSourceDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  slug?: string;

  @IsOptional()
  @IsEnum(SourceType)
  sourceType?: SourceType;

  @IsOptional()
  @IsString()
  countryCode?: string | null;

  @IsOptional()
  @IsString()
  language?: 'fa' | 'en';

  @IsOptional()
  @IsUrl()
  baseUrl?: string;

  @IsOptional()
  @IsUrl()
  rssUrl?: string | null;

  @IsOptional()
  @IsUrl()
  sitemapUrl?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  credibilitySeed?: number;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsInt()
  @Min(60)
  fetchIntervalSec?: number;

  @IsOptional()
  @IsBoolean()
  requiresJavascript?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  rateLimitPerMinute?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(CoverageScope)
  coverageScope?: CoverageScope;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

@ApiTags('sources')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sources')
export class SourcesController {
  constructor(private readonly sourcesService: SourcesService) {}

  @Get()
  @RequirePermissions('sources:read')
  list(@Query('page') page = 1, @Query('pageSize') pageSize = 20) {
    return this.sourcesService.list(Number(page), Number(pageSize));
  }

  @Get(':id')
  @RequirePermissions('sources:read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.sourcesService.get(id);
  }

  @Post()
  @RequirePermissions('sources:write')
  create(@Body() body: CreateSourceDto) {
    return this.sourcesService.create({
      language: 'fa',
      credibilitySeed: 50,
      priority: 100,
      fetchIntervalSec: 900,
      requiresJavascript: false,
      rateLimitPerMinute: 10,
      isActive: true,
      coverageScope: CoverageScope.IRAN,
      ...body,
    });
  }

  @Patch(':id')
  @RequirePermissions('sources:write')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateSourceDto) {
    return this.sourcesService.update(id, body);
  }

  @Get(':id/feeds')
  @RequirePermissions('sources:read')
  feeds(@Param('id', ParseUUIDPipe) id: string) {
    return this.sourcesService.feeds(id);
  }

  @Get(':id/health')
  @RequirePermissions('sources:read')
  health(@Param('id', ParseUUIDPipe) id: string) {
    return this.sourcesService.health(id);
  }

  @Get(':id/runs')
  @RequirePermissions('sources:read')
  runs(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    return this.sourcesService.listRuns(id, Number(page), Number(pageSize));
  }

  @Get(':id/runs/:runId')
  @RequirePermissions('sources:read')
  run(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('runId', ParseUUIDPipe) runId: string,
  ) {
    return this.sourcesService.getRun(id, runId);
  }

  @Post(':id/crawl')
  @RequirePermissions('sources:write')
  crawl(@Param('id', ParseUUIDPipe) id: string) {
    return this.sourcesService.triggerCrawl(id);
  }
}
