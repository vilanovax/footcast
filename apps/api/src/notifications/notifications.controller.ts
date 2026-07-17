import {
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
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { NotificationsService } from './notifications.service.js';

class ListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  unreadOnly?: boolean;
}

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @RequirePermissions('notifications:read')
  list(@Query() query: ListQueryDto, @Req() req: { user: { userId: string } }) {
    return this.notificationsService.list(
      req.user.userId,
      query.page ?? 1,
      query.pageSize ?? 30,
      query.unreadOnly ?? false,
    );
  }

  @Get('unread-count')
  @RequirePermissions('notifications:read')
  unread(@Req() req: { user: { userId: string } }) {
    return this.notificationsService.unreadCount(req.user.userId);
  }

  @Post('read-all')
  @RequirePermissions('notifications:write')
  markAll(@Req() req: { user: { userId: string } }) {
    return this.notificationsService.markAllRead(req.user.userId);
  }

  @Post(':id/read')
  @RequirePermissions('notifications:write')
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.notificationsService.markRead(id, req.user.userId);
  }
}
