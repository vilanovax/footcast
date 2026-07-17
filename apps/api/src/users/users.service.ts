import { Inject, Injectable } from '@nestjs/common';
import type { Database } from '@footcast/database';
import { DATABASE_TOKEN } from '../database/database.tokens.js';

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: Database) {}

  async list() {
    const rows = await this.db.models.User.findAll({
      attributes: ['id', 'email', 'displayName', 'isActive', 'createdAt'],
      order: [['createdAt', 'DESC']],
    });
    return rows.map((row) => row.toJSON());
  }
}
