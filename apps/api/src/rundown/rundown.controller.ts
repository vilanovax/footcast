import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RundownItemStatus, RundownSection } from '@footcast/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { RundownService } from './rundown.service.js';

class OpenWaveDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  profile?: string;
}

class MarkSeenDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids!: string[];
}

class AddItemDto {
  @IsUUID()
  eventId!: string;

  @IsOptional()
  @IsIn(Object.values(RundownSection))
  section?: RundownSection;

  @IsOptional()
  @IsString()
  editorialDate?: string;
}

class UpdateItemDto {
  @IsOptional()
  @IsIn(Object.values(RundownItemStatus))
  status?: RundownItemStatus;

  @IsOptional()
  @IsIn(Object.values(RundownSection))
  section?: RundownSection;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsBoolean()
  isLeadStory?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  editorialPriority?: number;

  @IsOptional()
  @IsString()
  editorNote?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(300)
  estimatedDurationSeconds?: number;

  @IsOptional()
  @IsIn(['PENDING_REVIEW', 'ACCEPTED', 'DISMISSED'])
  reviewStatus?: 'PENDING_REVIEW' | 'ACCEPTED' | 'DISMISSED';
}

class RemoveItemDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

class ReopenDto {
  @IsString()
  @MinLength(3)
  reason!: string;

  @IsOptional()
  @IsString()
  editorialDate?: string;
}

class ReplaceDto {
  @IsUUID()
  newEventId!: string;

  @IsOptional()
  @IsUUID()
  replaceItemId?: string;

  @IsOptional()
  @IsUUID()
  replaceEventId?: string;

  @IsOptional()
  @IsString()
  editorialDate?: string;
}

@ApiTags('waves')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('waves')
export class WavesController {
  constructor(private readonly rundown: RundownService) {}

  @Get()
  @RequirePermissions('editorial:read')
  list(@Query('editorialDate') editorialDate?: string) {
    return this.rundown.listWaves(editorialDate);
  }

  @Post('open')
  @RequirePermissions('editorial:decide')
  open(@Body() body: OpenWaveDto) {
    return this.rundown.openWave(body.label, body.profile);
  }

  @Post('observations/mark-seen')
  @RequirePermissions('editorial:decide')
  markSeen(
    @Body() body: MarkSeenDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.rundown.markObservationsSeen(body.ids, req.user.userId);
  }

  @Post('backfill')
  @RequirePermissions('editorial:decide')
  backfill(@Body() body: { waveId?: string } = {}) {
    return this.rundown.backfillWave(body.waveId);
  }

  @Get(':id')
  @RequirePermissions('editorial:read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.rundown.getWave(id);
  }

  @Post(':id/complete')
  @RequirePermissions('editorial:decide')
  complete(@Param('id', ParseUUIDPipe) id: string) {
    return this.rundown.completeWave(id);
  }

  @Get(':id/inbox')
  @RequirePermissions('editorial:read')
  inbox(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('tab')
    tab?: 'new' | 'developments' | 'confirmations' | 'conflicts' | 'unseen' | 'all',
  ) {
    return this.rundown.waveInbox(id, tab ?? 'unseen');
  }
}

@ApiTags('rundown')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('rundown')
export class RundownController {
  constructor(private readonly rundown: RundownService) {}

  @Get('today')
  @RequirePermissions('editorial:read')
  today(@Query('editorialDate') editorialDate?: string) {
    return this.rundown.getOrCreateToday(editorialDate);
  }

  @Get('today/event-ids')
  @RequirePermissions('editorial:read')
  todayIds(@Query('editorialDate') editorialDate?: string) {
    return this.rundown.todayEventIds(editorialDate);
  }

  @Post('today/items')
  @RequirePermissions('editorial:decide')
  addItem(
    @Body() body: AddItemDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.rundown.addItem(body.eventId, req.user.userId, {
      section: body.section,
      editorialDate: body.editorialDate,
    });
  }

  @Patch('items/:id')
  @RequirePermissions('editorial:decide')
  updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateItemDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.rundown.updateItem(id, req.user.userId, body);
  }

  @Delete('items/:id')
  @RequirePermissions('editorial:decide')
  removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RemoveItemDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.rundown.removeItem(id, req.user.userId, body.reason);
  }

  @Post('items/:id/undo-auto')
  @RequirePermissions('editorial:decide')
  undoAutoAdd(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RemoveItemDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.rundown.undoAutoAdd(id, req.user.userId, body?.reason);
  }

  @Post('today/lock')
  @RequirePermissions('editorial:decide')
  lock(
    @Body() body: { editorialDate?: string } = {},
    @Req() req: { user: { userId: string } },
  ) {
    return this.rundown.lockToday(req.user.userId, body?.editorialDate);
  }

  @Post('today/reopen')
  @RequirePermissions('editorial:decide')
  reopen(
    @Body() body: ReopenDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.rundown.reopenToday(
      req.user.userId,
      body.reason,
      body.editorialDate,
    );
  }

  @Get('today/replace-suggestions')
  @RequirePermissions('editorial:read')
  suggestions(
    @Query('eventId', ParseUUIDPipe) eventId: string,
    @Query('editorialDate') editorialDate?: string,
  ) {
    return this.rundown.replaceSuggestions(eventId, editorialDate);
  }

  @Post('today/replace')
  @RequirePermissions('editorial:decide')
  replace(
    @Body() body: ReplaceDto,
    @Req() req: { user: { userId: string } },
  ) {
    if (body.replaceEventId) {
      return this.rundown.applyReplaceByEventId(
        body.newEventId,
        body.replaceEventId,
        req.user.userId,
        body.editorialDate,
      );
    }
    if (!body.replaceItemId) {
      throw new BadRequestException('replaceItemId or replaceEventId required');
    }
    return this.rundown.applyReplace(
      body.newEventId,
      body.replaceItemId,
      req.user.userId,
      body.editorialDate,
    );
  }
}
