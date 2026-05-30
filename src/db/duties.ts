import Database from 'better-sqlite3';
import type { Duty } from '../types.js';

export function createDuty(
  db: Database.Database,
  familyId: number,
  ruleId: number,
  memberId: number,
  dutyDate: string,
): Duty {
  const result = db.prepare(`
    INSERT INTO duties (family_id, rule_id, member_id, duty_date, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `).run(familyId, ruleId, memberId, dutyDate, Date.now());
  return db.prepare('SELECT * FROM duties WHERE id = ?').get(result.lastInsertRowid) as Duty;
}

export function getDutiesForDate(db: Database.Database, familyId: number, date: string): Duty[] {
  return db.prepare(
    'SELECT * FROM duties WHERE family_id = ? AND duty_date = ?'
  ).all(familyId, date) as Duty[];
}

export function getDutyById(db: Database.Database, id: number): Duty | null {
  return (db.prepare('SELECT * FROM duties WHERE id = ?').get(id) as Duty) ?? null;
}

export function markDone(db: Database.Database, dutyId: number): void {
  db.prepare(
    "UPDATE duties SET status = 'done', done_at = ? WHERE id = ?"
  ).run(Date.now(), dutyId);
}

export function requestApproval(db: Database.Database, dutyId: number, requestedBy: number): void {
  db.prepare(
    "UPDATE duties SET status = 'approval_pending', requested_by = ? WHERE id = ?"
  ).run(requestedBy, dutyId);
}

export function approveOrReject(
  db: Database.Database,
  dutyId: number,
  approvedBy: number,
  approved: boolean,
): void {
  if (approved) {
    db.prepare(
      "UPDATE duties SET status = 'done', approved_by = ?, done_at = ? WHERE id = ?"
    ).run(approvedBy, Date.now(), dutyId);
  } else {
    db.prepare(
      "UPDATE duties SET status = 'pending', requested_by = NULL WHERE id = ?"
    ).run(dutyId);
  }
}

export function hasDutyForDate(
  db: Database.Database,
  familyId: number,
  ruleId: number,
  date: string,
): boolean {
  return !!db.prepare(
    'SELECT id FROM duties WHERE family_id = ? AND rule_id = ? AND duty_date = ? LIMIT 1'
  ).get(familyId, ruleId, date);
}

export function getPendingDuties(db: Database.Database, familyId: number, date: string): Duty[] {
  return db.prepare(`
    SELECT * FROM duties
    WHERE family_id = ? AND duty_date = ? AND status IN ('pending','approval_pending')
  `).all(familyId, date) as Duty[];
}
