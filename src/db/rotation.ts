import Database from 'better-sqlite3';
import type { RotationState } from '../types.js';

export function getRotationState(db: Database.Database, ruleId: number): RotationState | null {
  return (db.prepare('SELECT * FROM rotation_state WHERE rule_id = ?').get(ruleId) as RotationState) ?? null;
}

export function upsertRotationState(
  db: Database.Database,
  ruleId: number,
  currentPos: number,
  lastAdvanced: string,
): void {
  db.prepare(`
    INSERT INTO rotation_state (rule_id, current_pos, last_advanced)
    VALUES (?, ?, ?)
    ON CONFLICT(rule_id) DO UPDATE SET current_pos = excluded.current_pos, last_advanced = excluded.last_advanced
  `).run(ruleId, currentPos, lastAdvanced);
}
