import Database from "better-sqlite3";
import type { Duty } from "@src/types";

export function createDuty(
  db: Database.Database,
  groupId: number,
  ruleId: number,
  memberId: number,
  dutyDate: string,
): Duty {
  const result = db
    .prepare(
      `
    INSERT INTO duties (group_id, rule_id, member_id, duty_date, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `,
    )
    .run(groupId, ruleId, memberId, dutyDate, Date.now());
  return db
    .prepare("SELECT * FROM duties WHERE id = ?")
    .get(result.lastInsertRowid) as Duty;
}

export function getDutiesForDate(
  db: Database.Database,
  groupId: number,
  date: string,
): Duty[] {
  return db
    .prepare("SELECT * FROM duties WHERE group_id = ? AND duty_date = ?")
    .all(groupId, date) as Duty[];
}

export function getDutyById(db: Database.Database, id: number): Duty | null {
  return (
    (db.prepare("SELECT * FROM duties WHERE id = ?").get(id) as Duty) ?? null
  );
}

export function markDone(
  db: Database.Database,
  dutyId: number,
  doneBy: number,
): void {
  db.prepare(
    "UPDATE duties SET status = 'done', done_by = ?, done_at = ? WHERE id = ?",
  ).run(doneBy, Date.now(), dutyId);
}

export function requestApproval(
  db: Database.Database,
  dutyId: number,
  requestedBy: number,
): void {
  db.prepare(
    "UPDATE duties SET status = 'approval_pending', requested_by = ? WHERE id = ?",
  ).run(requestedBy, dutyId);
}

export function approveOrReject(
  db: Database.Database,
  dutyId: number,
  approvedBy: number,
  approved: boolean,
  doneBy?: number,
): void {
  if (approved) {
    db.prepare(
      "UPDATE duties SET status = 'done', approved_by = ?, done_by = ?, done_at = ? WHERE id = ?",
    ).run(approvedBy, doneBy ?? approvedBy, Date.now(), dutyId);
  } else {
    db.prepare(
      "UPDATE duties SET status = 'pending', requested_by = NULL WHERE id = ?",
    ).run(dutyId);
  }
}

export function hasDutyForDate(
  db: Database.Database,
  groupId: number,
  ruleId: number,
  date: string,
): boolean {
  return !!db
    .prepare(
      "SELECT id FROM duties WHERE group_id = ? AND rule_id = ? AND duty_date = ? LIMIT 1",
    )
    .get(groupId, ruleId, date);
}

export function getPendingDuties(
  db: Database.Database,
  groupId: number,
  date: string,
): Duty[] {
  return db
    .prepare(
      `
    SELECT * FROM duties
    WHERE group_id = ? AND duty_date = ? AND status IN ('pending','approval_pending')
  `,
    )
    .all(groupId, date) as Duty[];
}
