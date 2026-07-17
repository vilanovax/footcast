import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';
import { EventStatus } from '@footcast/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { EventsService } from './events.service.js';

class MergeEventDto {
  @IsUUID()
  targetEventId!: string;
}

class SplitEventDto {
  @IsUUID()
  articleId!: string;
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

  @Post('events/:id/merge')
  @RequirePermissions('events:merge')
  merge(@Param('id', ParseUUIDPipe) id: string, @Body() body: MergeEventDto) {
    return this.eventsService.merge(id, body.targetEventId);
  }

  @Post('events/:id/split')
  @RequirePermissions('events:merge')
  split(@Param('id', ParseUUIDPipe) id: string, @Body() body: SplitEventDto) {
    return this.eventsService.split(id, body.articleId);
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
