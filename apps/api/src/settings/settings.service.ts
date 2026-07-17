import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Database } from '@footcast/database';
import { DATABASE_TOKEN } from '../database/database.tokens.js';

@Injectable()
export class SettingsService {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: Database) {}

  async list() {
    const rows = await this.db.models.AppSetting.findAll({ order: [['key', 'ASC']] });
    return rows.map((row) => row.toJSON());
  }

  async update(key: string, value: unknown) {
    const setting = await this.db.models.AppSetting.findByPk(key);
    if (!setting) {
      throw new NotFoundException('Setting not found');
    }
    await setting.update({ value });
    return setting.toJSON();
  }
}
