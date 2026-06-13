import Database from "better-sqlite3";
import { RotationMode } from "../types.js";
import { getActiveRules, getFixedAssignments } from "../db/rules.js";
import { getActiveKids } from "../db/groups.js";
import { createDuty, hasDutyForDate } from "../db/duties.js";
import { getRotationState, upsertRotationState } from "../db/rotation.js";
import { matchesDate } from "../domain/schedule.js";
import { getAssignedMembers } from "../domain/assignment.js";
import { advancePosition } from "../domain/rotation.js";

export function toDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function generateDutiesForDate(
  db: Database.Database,
  groupId: number,
  date: Date,
): void {
  const dateStr = toDateStr(date);
  const rules = getActiveRules(db, groupId);
  const kids = getActiveKids(db, groupId);

  rules.forEach((rule) => {
    if (!matchesDate(rule.schedule, date)) return;
    if (hasDutyForDate(db, groupId, rule.id, dateStr)) return;

    const fixedAssignments = getFixedAssignments(db, rule.id);
    const rotationState = getRotationState(db, rule.id);
    const assigned = getAssignedMembers(
      rule,
      kids,
      fixedAssignments,
      rotationState,
    );

    assigned.forEach((member) =>
      createDuty(db, groupId, rule.id, member.id, dateStr),
    );

    if (rule.rotation_mode === RotationMode.RoundRobin && kids.length > 0) {
      const newPos = advancePosition(
        rotationState?.current_pos ?? 0,
        kids.length,
        rule.workers_count,
      );
      upsertRotationState(db, rule.id, newPos, dateStr);
    }
  });
}
