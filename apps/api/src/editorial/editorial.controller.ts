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
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
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
}
