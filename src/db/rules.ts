import Database from "better-sqlite3";
import type { WorkRule, FixedAssignment } from "../types.js";

export function createRule(
  db: Database.Database,
  groupId: number,
  name: string,
  schedule: string,
  workersCount: number,
  rotationMode: WorkRule["rotation_mode"],
): WorkRule {
  const result = db
    .prepare(
      `
    INSERT INTO work_rules (group_id, name, schedule, workers_count, rotation_mode, active)
    VALUES (?, ?, ?, ?, ?, 1)
  `,
    )
    .run(groupId, name, schedule, workersCount, rotationMode);
  return db
    .prepare("SELECT * FROM work_rules WHERE id = ?")
    .get(result.lastInsertRowid) as WorkRule;
}

export function getActiveRules(
  db: Database.Database,
  groupId: number,
): WorkRule[] {
  return db
    .prepare("SELECT * FROM work_rules WHERE group_id = ? AND active = 1")
    .all(groupId) as WorkRule[];
}

export function setFixedAssignments(
  db: Database.Database,
  ruleId: number,
  memberIds: number[],
): void {
  const del = db.prepare("DELETE FROM fixed_assignments WHERE rule_id = ?");
  const ins = db.prepare(
    "INSERT INTO fixed_assignments (rule_id, member_id) VALUES (?, ?)",
  );
  db.transaction(() => {
    del.run(ruleId);
    memberIds.forEach((id) => ins.run(ruleId, id));
  })();
}

export function getFixedAssignments(
  db: Database.Database,
  ruleId: number,
): FixedAssignment[] {
  return db
    .prepare("SELECT * FROM fixed_assignments WHERE rule_id = ?")
    .all(ruleId) as FixedAssignment[];
}

export function deactivateRule(db: Database.Database, ruleId: number): void {
  db.prepare("UPDATE work_rules SET active = 0 WHERE id = ?").run(ruleId);
}
