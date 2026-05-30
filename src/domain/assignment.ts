import type { Member, WorkRule, FixedAssignment, RotationState } from '../types.js';
import { getNextPositions } from './rotation.js';

export function getAssignedMembers(
  rule: WorkRule,
  kids: Member[],
  fixedAssignments: FixedAssignment[],
  rotationState: RotationState | null,
): Member[] {
  switch (rule.rotation_mode) {
    case 'all':
      return kids;

    case 'fixed': {
      const fixedIds = new Set(fixedAssignments.map(a => a.member_id));
      return kids.filter(k => fixedIds.has(k.id));
    }

    case 'round_robin': {
      const pos = rotationState?.current_pos ?? 0;
      const positions = getNextPositions(pos, kids.length, rule.workers_count);
      return positions.map(i => kids[i]);
    }
  }
}
