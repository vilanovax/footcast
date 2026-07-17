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
import { IsOptional, IsString, IsUrl, IsUUID } from 'class-validator';
import { ArticleStatus } from '@footcast/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { ArticlesService } from './articles.service.js';

class CreateArticleDto {
  @IsUUID()
  sourceId!: string;

  @IsUrl()
  canonicalUrl!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  publishedAt?: string;
}

@ApiTags('articles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  @RequirePermissions('articles:read')
  list(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('status') status?: ArticleStatus,
  ) {
    return this.articlesService.list(Number(page), Number(pageSize), status);
  }

  @Get(':id/content')
  @RequirePermissions('articles:read')
  content(@Param('id', ParseUUIDPipe) id: string) {
    return this.articlesService.getContent(id);
  }

  @Get(':id/extraction')
  @RequirePermissions('articles:read')
  extraction(@Param('id', ParseUUIDPipe) id: string) {
    return this.articlesService.getLatestExtraction(id);
  }

  @Get(':id')
  @RequirePermissions('articles:read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.articlesService.get(id);
  }

  @Post()
  @RequirePermissions('articles:write')
  create(@Body() body: CreateArticleDto) {
    return this.articlesService.createDiscovered(body);
  }

  @Post(':id/reprocess')
  @RequirePermissions('articles:reprocess')
  reprocess(@Param('id', ParseUUIDPipe) id: string) {
    return this.articlesService.reprocess(id);
  }

  @Post(':id/parse')
  @RequirePermissions('articles:reprocess')
  parse(@Param('id', ParseUUIDPipe) id: string) {
    return this.articlesService.enqueueParse(id);
  }

  @Post(':id/extract')
  @RequirePermissions('articles:reprocess')
  extract(@Param('id', ParseUUIDPipe) id: string) {
    return this.articlesService.enqueueExtract(id);
  }
}
