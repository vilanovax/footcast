import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { ClusteringService } from './clustering.service.js';

class EvaluationDto {
  @IsUUID()
  rawArticleId!: string;

  @IsIn([
    'EXACT_DUPLICATE',
    'NEAR_DUPLICATE',
    'SAME_EVENT',
    'NEW_DEVELOPMENT',
    'RELATED_BUT_DIFFERENT',
    'UNRELATED',
  ])
  expectedRelationship!: string;

  @IsIn(['CORRECT', 'WRONG_MERGE', 'MISSED_MERGE', 'WRONG_RELATIONSHIP', 'UNCERTAIN'])
  verdict!: string;

  @IsOptional()
  @IsUUID()
  expectedEventId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

class CreateEntityDto {
  @IsString()
  @MinLength(2)
  type!: string;

  @IsString()
  @MinLength(2)
  canonicalName!: string;

  @IsOptional()
  aliases?: Array<{ alias: string; language?: string }>;
}

class AddAliasDto {
  @IsString()
  @MinLength(1)
  alias!: string;

  @IsOptional()
  @IsString()
  language?: string;
}

@ApiTags('clustering')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('clustering')
export class ClusteringController {
  constructor(private readonly clusteringService: ClusteringService) {}

  @Get('queue')
  @RequirePermissions('events:read')
  queue(@Query('page') page = 1, @Query('pageSize') pageSize = 20) {
    return this.clusteringService.listQueue(Number(page), Number(pageSize));
  }

  @Get('articles/:id/review')
  @RequirePermissions('events:read')
  review(@Param('id', ParseUUIDPipe) id: string) {
    return this.clusteringService.getReviewItem(id);
  }

  @Post('evaluations')
  @RequirePermissions('events:merge')
  createEvaluation(
    @Body() body: EvaluationDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.clusteringService.createEvaluation({
      ...body,
      reviewerId: req.user.userId,
    });
  }

  @Get('evaluations')
  @RequirePermissions('events:read')
  listEvaluations(@Query('page') page = 1, @Query('pageSize') pageSize = 50) {
    return this.clusteringService.listEvaluations(Number(page), Number(pageSize));
  }

  @Get('evaluations/export')
  @RequirePermissions('events:read')
  export(@Query('format') format: 'json' | 'csv' = 'json') {
    return this.clusteringService.exportEvaluations(format === 'csv' ? 'csv' : 'json');
  }

  @Get('metrics')
  @RequirePermissions('events:read')
  metrics(
    @Query('relationship') relationship?: string,
    @Query('aiUsed') aiUsed?: string,
    @Query('scoreMin') scoreMin?: string,
    @Query('scoreMax') scoreMax?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.clusteringService.metrics({
      relationship,
      aiUsed: aiUsed === 'true' ? true : aiUsed === 'false' ? false : undefined,
      scoreMin: scoreMin != null ? Number(scoreMin) : undefined,
      scoreMax: scoreMax != null ? Number(scoreMax) : undefined,
      from,
      to,
    });
  }

  @Get('error-report')
  @RequirePermissions('events:read')
  errorReport() {
    return this.clusteringService.errorReport();
  }

  @Get('entities')
  @RequirePermissions('events:read')
  entities() {
    return this.clusteringService.listEntities();
  }

  @Post('entities')
  @RequirePermissions('events:write')
  createEntity(@Body() body: CreateEntityDto) {
    return this.clusteringService.createEntity(body);
  }

  @Post('entities/:id/aliases')
  @RequirePermissions('events:write')
  addAlias(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AddAliasDto,
  ) {
    return this.clusteringService.addAlias(id, body.alias, body.language);
  }

  @Get('events/search')
  @RequirePermissions('events:read')
  searchEvents(@Query('q') q = '', @Query('limit') limit = 20) {
    return this.clusteringService.searchEvents(q, Number(limit));
  }

  @Post('backfill-decision-logs')
  @RequirePermissions('events:write')
  backfill(@Query('limit') limit = 500) {
    return this.clusteringService.backfillDecisionLogs(Number(limit));
  }
}
