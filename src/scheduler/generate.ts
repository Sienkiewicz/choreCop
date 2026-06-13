import Database from "better-sqlite3";
import { RotationMode } from "@src/types";
import { getActiveRules, getFixedAssignments } from "@src/db/rules";
import { getActiveKids } from "@src/db/groups";
import { createDuty, hasDutyForDate } from "@src/db/duties";
import { getRotationState, upsertRotationState } from "@src/db/rotation";
import { matchesDate } from "@src/domain/schedule";
import { getAssignedMembers } from "@src/domain/assignment";
import { advancePosition } from "@src/domain/rotation";

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
