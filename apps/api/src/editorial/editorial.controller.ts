import {
  Body,
  Controller,
  Delete,
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
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EventStatus } from '@footcast/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { EditorialService } from './editorial.service.js';

class DecideDto {
  @IsIn(['approve', 'reject'])
  decision!: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  reason?: string;
}

class NoteDto {
  @IsString()
  @MinLength(1)
  body!: string;
}

class ScoreOverrideDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  overriddenFinalScore!: number;

  @IsString()
  @MinLength(3)
  reason!: string;
}

class BulkEventIdsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  eventIds!: string[];

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsBoolean()
  recluster?: boolean;
}

class BulkDecideDto extends BulkEventIdsDto {
  @IsIn(['approve', 'reject'])
  decision!: 'approve' | 'reject';
}

@ApiTags('editorial')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('editorial')
export class EditorialController {
  constructor(private readonly editorialService: EditorialService) {}

  @Get('inbox')
  @RequirePermissions('editorial:read')
  inbox(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('status') status?: EventStatus,
    @Query('scope') scope?: string,
    @Query('category') category?: string,
    @Query('officialStatus') officialStatus?: string,
    @Query('minImportance') minImportance?: string,
    @Query('minFinalScore') minFinalScore?: string,
    @Query('minCredibilityScore') minCredibilityScore?: string,
    @Query('recommendation') recommendation?: string,
    @Query('sourceId') sourceId?: string,
    @Query('hasManualOverride') hasManualOverride?: string,
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.editorialService.inbox({
      page: Number(page),
      pageSize: Number(pageSize),
      status,
      scope,
      category,
      officialStatus,
      minImportance: minImportance != null ? Number(minImportance) : undefined,
      minFinalScore: minFinalScore != null ? Number(minFinalScore) : undefined,
      minCredibilityScore:
        minCredibilityScore != null ? Number(minCredibilityScore) : undefined,
      recommendation,
      sourceId,
      hasManualOverride:
        hasManualOverride === '1' || hasManualOverride === 'true'
          ? true
          : hasManualOverride === '0' || hasManualOverride === 'false'
            ? false
            : undefined,
      q,
      from,
      to,
    });
  }

  @Get('selected')
  @RequirePermissions('editorial:read')
  selected(@Query('page') page = 1, @Query('pageSize') pageSize = 20) {
    return this.editorialService.selected(Number(page), Number(pageSize));
  }

  @Get('rules')
  @RequirePermissions('editorial:read')
  rules() {
    return this.editorialService.listRules();
  }

  @Get('decisions')
  @RequirePermissions('editorial:read')
  decisions(@Query('page') page = 1, @Query('pageSize') pageSize = 30) {
    return this.editorialService.listDecisions(Number(page), Number(pageSize));
  }

  @Get('events/:id')
  @RequirePermissions('editorial:read')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.editorialService.getDetail(id);
  }

  @Post('events/:id/score')
  @RequirePermissions('editorial:decide')
  score(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('sync') sync?: string,
  ) {
    if (sync === '1' || sync === 'true') {
      return this.editorialService.scoreSync(id);
    }
    return this.editorialService.scoreNow(id);
  }

  @Post('events/:id/score-override')
  @RequirePermissions('editorial:decide')
  setOverride(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ScoreOverrideDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.editorialService.setScoreOverride(
      id,
      req.user.userId,
      body.overriddenFinalScore,
      body.reason,
    );
  }

  @Delete('events/:id/score-override')
  @RequirePermissions('editorial:decide')
  revokeOverride(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.editorialService.revokeScoreOverride(id, req.user.userId);
  }

  @Post('events/:id/decide')
  @RequirePermissions('editorial:decide')
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DecideDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.editorialService.decide(id, req.user.userId, body.decision, body.reason);
  }

  @Post('events/:id/approve')
  @RequirePermissions('editorial:decide')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
    @Req() req: { user: { userId: string } },
  ) {
    return this.editorialService.decide(id, req.user.userId, 'approve', body?.reason);
  }

  @Post('events/:id/reject')
  @RequirePermissions('editorial:decide')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
    @Req() req: { user: { userId: string } },
  ) {
    return this.editorialService.decide(id, req.user.userId, 'reject', body?.reason);
  }

  @Post('events/:id/notes')
  @RequirePermissions('editorial:notes')
  note(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: NoteDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.editorialService.addNote(id, req.user.userId, body.body);
  }

  @Post('events/:id/reextract')
  @RequirePermissions('articles:reprocess')
  reextractOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.editorialService.reextractEvent(id, req.user.userId);
  }

  @Post('bulk/decide')
  @RequirePermissions('editorial:decide')
  bulkDecide(
    @Body() body: BulkDecideDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.editorialService.bulkDecide(
      body.eventIds,
      req.user.userId,
      body.decision,
      body.reason,
    );
  }

  @Post('bulk/score')
  @RequirePermissions('editorial:decide')
  bulkScore(@Body() body: BulkEventIdsDto) {
    return this.editorialService.bulkScore(body.eventIds);
  }

  @Post('bulk/reextract')
  @RequirePermissions('articles:reprocess')
  bulkReextract(
    @Body() body: BulkEventIdsDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.editorialService.bulkReextract(body.eventIds, {
      recluster: body.recluster !== false,
      actorUserId: req.user.userId,
    });
  }

  @Post('bulk/recluster')
  @RequirePermissions('events:merge')
  bulkRecluster(@Body() body: BulkEventIdsDto) {
    return this.editorialService.bulkRecluster(body.eventIds);
  }
}
