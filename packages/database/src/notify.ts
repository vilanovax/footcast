import { randomUUID } from 'node:crypto';
import type { Database } from './connection.js';

export interface CreateNotificationInput {
  type: string;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  href?: string | null;
  /** null = broadcast to all readers */
  userId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function createNotification(
  db: Database,
  input: CreateNotificationInput,
): Promise<string> {
  const id = randomUUID();
  await db.models.Notification.create({
    id,
    userId: input.userId ?? null,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    href: input.href ?? null,
    readAt: null,
    metadata: input.metadata ?? null,
  });
  return id;
}
