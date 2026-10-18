import type { DB } from './db/database';

export function audit(db: DB, userId: string | null, action: string, entity: string, entityId: string | null): void {
  db.prepare('INSERT INTO audit_log (user_id, action, entity, entity_id) VALUES (?, ?, ?, ?)').run(userId, action, entity, entityId);
}
