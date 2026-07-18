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
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { EventStatus } from '@footcast/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { EventsService } from './events.service.js';

class MergeEventDto {
  @IsUUID()
  targetEventId!: string;
}

class MergeManyDto {
  @IsUUID()
  primaryEventId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  secondaryEventIds!: string[];

  @IsString()
  @MinLength(3)
  reason!: string;
}

class SplitBodyDto {
  @IsOptional()
  @IsUUID()
  articleId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  articleIds?: string[];

  @IsOptional()
  @IsString()
  @MinLength(3)
  reason?: string;

  @IsOptional()
  @IsString()
  newHeadline?: string;
}

class ResolveConflictDto {
  @IsIn(['confirm_merge', 'split', 'dismiss'])
  resolution!: 'confirm_merge' | 'split' | 'dismiss';
}

@ApiTags('events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get('events')
  @RequirePermissions('events:read')
  list(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('status') status?: EventStatus,
  ) {
    return this.eventsService.list(Number(page), Number(pageSize), status);
  }

  @Get('events/conflicts')
  @RequirePermissions('events:read')
  conflicts(@Query('status') status = 'open') {
    return this.eventsService.listConflicts(status);
  }

  @Get('events/:id')
  @RequirePermissions('events:read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.get(id);
  }

  @Get('events/:id/articles')
  @RequirePermissions('events:read')
  articles(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.listArticles(id);
  }

  @Post('events/merge')
  @RequirePermissions('events:merge')
  mergeMany(
    @Body() body: MergeManyDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.eventsService.mergeMany(
      body.primaryEventId,
      body.secondaryEventIds,
      body.reason,
      req.user.userId,
    );
  }

  @Post('events/:id/merge')
  @RequirePermissions('events:merge')
  merge(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MergeEventDto,
    @Req() req: { user: { userId: string } },
  ) {
    // legacy: :id is source, body.target is primary destination
    return this.eventsService.mergeMany(
      body.targetEventId,
      [id],
      'legacy merge endpoint',
      req.user.userId,
    );
  }

  @Post('events/:id/split')
  @RequirePermissions('events:merge')
  split(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SplitBodyDto,
    @Req() req: { user: { userId: string } },
  ) {
    const ids =
      body.articleIds && body.articleIds.length > 0
        ? body.articleIds
        : body.articleId
          ? [body.articleId]
          : [];
    return this.eventsService.splitMany(
      id,
      ids,
      body.reason ?? 'manual split',
      body.newHeadline,
      req.user.userId,
    );
  }

  @Post('events/conflicts/:id/resolve')
  @RequirePermissions('events:merge')
  resolveConflict(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ResolveConflictDto,
  ) {
    return this.eventsService.resolveConflict(id, body.resolution);
  }

  @Post('articles/:id/cluster')
  @RequirePermissions('articles:reprocess')
  cluster(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.enqueueCluster(id);
  }
}
