import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { access } from 'node:fs/promises';
import type { Response } from 'express';
import { EpisodeStatus } from '@footcast/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { PodcastsService } from './podcasts.service.js';

class CreateEpisodeDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(8)
  @Max(12)
  targetDurationMin?: number;

  @IsOptional()
  @IsString()
  hostNotes?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  eventIds?: string[];
}

class AddItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  eventIds!: string[];
}

class ReorderDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  orderedEventIds!: string[];
}

@ApiTags('podcasts')
@Controller('podcasts')
export class PodcastsPublicController {
  constructor(private readonly podcastsService: PodcastsService) {}

  @Get('rss.xml')
  async rss(@Res() res: Response) {
    const xml = await this.podcastsService.buildRssFeed();
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    return res.send(xml);
  }

  @Get(':id/audio/file')
  async audioFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const file = await this.podcastsService.resolveAudioFile(id);
    try {
      await access(file.storagePath);
    } catch {
      throw new NotFoundException('Audio file missing on disk');
    }
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.fileName}"`);
    return res.sendFile(file.storagePath);
  }
}

@ApiTags('podcasts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('podcasts')
export class PodcastsController {
  constructor(private readonly podcastsService: PodcastsService) {}

  @Get()
  @RequirePermissions('podcasts:read')
  list(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('status') status?: EpisodeStatus,
  ) {
    return this.podcastsService.list(Number(page), Number(pageSize), status);
  }

  @Get(':id')
  @RequirePermissions('podcasts:read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.podcastsService.get(id);
  }

  @Post()
  @RequirePermissions('podcasts:write')
  create(
    @Body() body: CreateEpisodeDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.podcastsService.create({
      ...body,
      createdBy: req.user.userId,
    });
  }

  @Post(':id/items')
  @RequirePermissions('podcasts:write')
  addItems(@Param('id', ParseUUIDPipe) id: string, @Body() body: AddItemsDto) {
    return this.podcastsService.addItems(id, body.eventIds);
  }

  @Put(':id/items/reorder')
  @RequirePermissions('podcasts:write')
  reorder(@Param('id', ParseUUIDPipe) id: string, @Body() body: ReorderDto) {
    return this.podcastsService.reorderItems(id, body.orderedEventIds);
  }

  @Delete(':id/items/:eventId')
  @RequirePermissions('podcasts:write')
  removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ) {
    return this.podcastsService.removeItem(id, eventId);
  }

  @Post(':id/generate-script')
  @RequirePermissions('podcasts:write')
  generate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.podcastsService.enqueueGenerate(id, req.user.userId);
  }

  @Get(':id/script')
  @RequirePermissions('podcasts:read')
  script(@Param('id', ParseUUIDPipe) id: string) {
    return this.podcastsService.latestScript(id);
  }

  @Post(':id/approve-script')
  @RequirePermissions('podcasts:approve')
  approveScript(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.podcastsService.approveScript(id, req.user.userId);
  }

  @Post(':id/approve')
  @RequirePermissions('podcasts:approve')
  approveEpisode(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.podcastsService.approveEpisode(id, req.user.userId);
  }

  @Post(':id/generate-audio')
  @RequirePermissions('podcasts:write')
  generateAudio(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.podcastsService.enqueueAudio(id, req.user.userId);
  }

  @Get(':id/audio')
  @RequirePermissions('podcasts:read')
  audio(@Param('id', ParseUUIDPipe) id: string) {
    return this.podcastsService.latestAudio(id);
  }

  @Post(':id/publish')
  @RequirePermissions('podcasts:publish')
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.podcastsService.enqueuePublish(id, req.user.userId);
  }
}
