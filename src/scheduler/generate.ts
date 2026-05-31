import Database from 'better-sqlite3';
import { getActiveRules, getFixedAssignments } from '../db/rules.js';
import { getActiveKids } from '../db/families.js';
import { createDuty, hasDutyForDate } from '../db/duties.js';
import { getRotationState, upsertRotationState } from '../db/rotation.js';
import { matchesDate } from '../domain/schedule.js';
import { getAssignedMembers } from '../domain/assignment.js';
import { advancePosition } from '../domain/rotation.js';

export function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function generateDutiesForDate(
  db: Database.Database,
  familyId: number,
  date: Date,
): void {
  const dateStr = toDateStr(date);
  const rules = getActiveRules(db, familyId);
  const kids = getActiveKids(db, familyId);

  rules.forEach(rule => {
    if (!matchesDate(rule.schedule, date)) return;
    if (hasDutyForDate(db, familyId, rule.id, dateStr)) return;

    const fixedAssignments = getFixedAssignments(db, rule.id);
    const rotationState = getRotationState(db, rule.id);
    const assigned = getAssignedMembers(rule, kids, fixedAssignments, rotationState);

    assigned.forEach(member => createDuty(db, familyId, rule.id, member.id, dateStr));

    if (rule.rotation_mode === 'round_robin' && kids.length > 0) {
      const newPos = advancePosition(
        rotationState?.current_pos ?? 0,
        kids.length,
        rule.workers_count,
      );
      upsertRotationState(db, rule.id, newPos, dateStr);
    }
  });
}
