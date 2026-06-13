import type {
  Member,
  WorkRule,
  FixedAssignment,
  RotationState,
} from "@src/types";
import { RotationMode } from "@src/types";
import { getNextPositions } from "./rotation";

export function getAssignedMembers(
  rule: WorkRule,
  kids: Member[],
  fixedAssignments: FixedAssignment[],
  rotationState: RotationState | null,
): Member[] {
  switch (rule.rotation_mode) {
    case RotationMode.All:
      return kids;

    case RotationMode.Fixed: {
      const fixedIds = new Set(fixedAssignments.map((a) => a.member_id));
      return kids.filter((k) => fixedIds.has(k.id));
    }

    case RotationMode.RoundRobin: {
      const pos = rotationState?.current_pos ?? 0;
      const positions = getNextPositions(pos, kids.length, rule.workers_count);
      return positions.map((i) => kids[i]);
    }
  }
}
