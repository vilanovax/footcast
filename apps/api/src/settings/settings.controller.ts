import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Allow,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import type { SettingsSectionId } from '@footcast/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { SettingsService } from './settings.service.js';

class UpdateSettingDto {
  @Allow()
  value!: unknown;
}

class UpdateProductDto {
  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  nameFa?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(30)
  podcastMin?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(30)
  podcastMax?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(30)
  podcastDefault?: number;
}

class UpdateUiDto {
  @IsOptional()
  @IsIn(['pitch', 'dark', 'light'])
  theme?: 'pitch' | 'dark' | 'light';
}

class UpdateAiDto {
  @IsOptional()
  @IsIn(['mock', 'openai_compatible'])
  provider?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  modelExtract?: string;

  @IsOptional()
  @IsString()
  modelEvent?: string;

  @IsOptional()
  @IsString()
  modelEditorial?: string;

  @IsOptional()
  @IsString()
  modelJudge?: string;

  @IsOptional()
  @IsBoolean()
  clusterJudgeEnabled?: boolean;

  @IsOptional()
  @IsIn(['mock', 'openai'])
  embeddingProvider?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  apiKey?: string | null;

  @IsOptional()
  @IsBoolean()
  clearApiKey?: boolean;

  @IsOptional()
  @IsBoolean()
  auditLogPrompts?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  auditRetainDays?: number;

  @IsOptional()
  @IsString()
  ttsProvider?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  ttsApiKey?: string | null;

  @IsOptional()
  @IsBoolean()
  clearTtsApiKey?: boolean;
}

class ProviderKeyDto {
  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsBoolean()
  clear?: boolean;
}

class PatchControlDto {
  @Allow()
  data!: unknown;
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

  @Get('workspace')
  @RequirePermissions('settings:read')
  workspace() {
    return this.settingsService.workspace();
  }

  @Get('control')
  @RequirePermissions('settings:read')
  control() {
    return this.settingsService.controlCenter();
  }

  @Patch('control/:section')
  @RequirePermissions('settings:write')
  patchControl(
    @Param('section') section: SettingsSectionId,
    @Body() body: PatchControlDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.settingsService.patchControlSection(
      section,
      body.data,
      req.user.userId,
    );
  }

  @Post('control/providers/:id/key')
  @RequirePermissions('settings:write')
  setProviderKey(
    @Param('id') id: string,
    @Body() body: ProviderKeyDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.settingsService.setProviderKey(
      id,
      body.apiKey ?? null,
      Boolean(body.clear),
      req.user.userId,
    );
  }

  @Post('control/providers/:id/test')
  @RequirePermissions('settings:write')
  testProvider(
    @Param('id') id: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.settingsService.testProvider(id, req.user.userId);
  }

  @Patch('product')
  @RequirePermissions('settings:write')
  updateProduct(@Body() body: UpdateProductDto) {
    return this.settingsService.updateProduct(body);
  }

  @Patch('ui')
  @RequirePermissions('settings:write')
  updateUi(@Body() body: UpdateUiDto) {
    return this.settingsService.updateUi(body);
  }

  @Patch('ai')
  @RequirePermissions('settings:write')
  updateAi(@Body() body: UpdateAiDto) {
    return this.settingsService.updateAi(body);
  }

  @Patch(':key')
  @RequirePermissions('settings:write')
  update(@Param('key') key: string, @Body() body: UpdateSettingDto) {
    return this.settingsService.update(key, body.value);
  }
}
