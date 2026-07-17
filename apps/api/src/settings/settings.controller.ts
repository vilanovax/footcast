import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { SettingsService } from './settings.service.js';

class UpdateSettingDto {
  @Allow()
  value!: unknown;
}

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @RequirePermissions('settings:read')
  list() {
    return this.settingsService.list();
  }

  @Patch(':key')
  @RequirePermissions('settings:write')
  update(@Param('key') key: string, @Body() body: UpdateSettingDto) {
    return this.settingsService.update(key, body.value);
  }
}
