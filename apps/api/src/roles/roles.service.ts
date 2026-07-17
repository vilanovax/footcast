import { Inject, Injectable } from '@nestjs/common';
import type { Database } from '@footcast/database';
import { DATABASE_TOKEN } from '../database/database.tokens.js';

@Injectable()
export class RolesService {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: Database) {}

  async list() {
    const rows = await this.db.models.Role.findAll({
      include: [{ association: 'permissions' }],
      order: [['name', 'ASC']],
    });
    return rows.map((row) => row.toJSON());
  }
}
