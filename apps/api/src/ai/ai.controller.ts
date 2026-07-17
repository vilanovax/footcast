import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { AiService } from './ai.service.js';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('prompts')
  @RequirePermissions('settings:read')
  prompts() {
    return this.aiService.listPromptVersions();
  }

  @Get('usage')
  @RequirePermissions('dashboard:read')
  usage() {
    return this.aiService.usageSummary();
  }
}
