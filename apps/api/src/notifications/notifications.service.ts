import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Op, type Database } from '@footcast/database';
import { DATABASE_TOKEN } from '../database/database.tokens.js';

@Injectable()
export class NotificationsService {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: Database) {}

  async list(userId: string, page = 1, pageSize = 30, unreadOnly = false) {
    const where = {
      [Op.or]: [{ userId }, { userId: null }],
      ...(unreadOnly ? { readAt: null } : {}),
    };
    const { rows, count } = await this.db.models.Notification.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return {
      data: rows.map((row) => row.toJSON()),
      meta: { page, pageSize, total: count },
    };
  }

  async unreadCount(userId: string) {
    const count = await this.db.models.Notification.count({
      where: {
        [Op.or]: [{ userId }, { userId: null }],
        readAt: null,
      },
    });
    return { unread: count };
  }

  async markRead(id: string, userId: string) {
    const row = await this.db.models.Notification.findByPk(id);
    if (!row) throw new NotFoundException('Notification not found');
    const owner = row.getDataValue('userId');
    if (owner && owner !== userId) {
      throw new NotFoundException('Notification not found');
    }
    if (!row.getDataValue('readAt')) {
      await row.update({ readAt: new Date() });
    }
    return row.toJSON();
  }

  async markAllRead(userId: string) {
    const [updated] = await this.db.models.Notification.update(
      { readAt: new Date() },
      {
        where: {
          [Op.or]: [{ userId }, { userId: null }],
          readAt: null,
        },
      },
    );
    return { updated };
  }
}
