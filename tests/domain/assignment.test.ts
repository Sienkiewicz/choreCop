import { describe, it, expect } from "vitest";
import { getAssignedMembers } from "@src/domain/assignment";
import type {
  Member,
  WorkRule,
  FixedAssignment,
  RotationState,
} from "@src/types";

const kids: Member[] = [
  {
    id: 1,
    group_id: 1,
    telegram_id: 100,
    username: null,
    name: "Олег",
    role: "kid",
    gender: "male",
    kid_order: 1,
    active: 1,
  },
  {
    id: 2,
    group_id: 1,
    telegram_id: 101,
    username: null,
    name: "Аня",
    role: "kid",
    gender: "female",
    kid_order: 2,
    active: 1,
  },
  {
    id: 3,
    group_id: 1,
    telegram_id: 102,
    username: null,
    name: "Іра",
    role: "kid",
    gender: "female",
    kid_order: 3,
    active: 1,
  },
  {
    id: 4,
    group_id: 1,
    telegram_id: 103,
    username: null,
    name: "Том",
    role: "kid",
    gender: "male",
    kid_order: 4,
    active: 1,
  },
];

const baseRule = (
  mode: WorkRule["rotation_mode"],
  count: number,
): WorkRule => ({
  id: 1,
  group_id: 1,
  name: "Test",
  schedule: "daily",
  workers_count: count,
  rotation_mode: mode,
  active: 1,
});

describe("getAssignedMembers", () => {
  it("all mode returns every kid", () => {
    const result = getAssignedMembers(baseRule("all", 4), kids, [], null);
    expect(result.map((m) => m.id)).toEqual([1, 2, 3, 4]);
  });

  it("fixed mode returns only fixed kids", () => {
    const fixed: FixedAssignment[] = [
      { id: 1, rule_id: 1, member_id: 2 },
      { id: 2, rule_id: 1, member_id: 4 },
    ];
    const result = getAssignedMembers(baseRule("fixed", 2), kids, fixed, null);
    expect(result.map((m) => m.id)).toEqual([2, 4]);
  });

  it("round_robin from position 0 returns first kid", () => {
    const state: RotationState = {
      rule_id: 1,
      current_pos: 0,
      last_advanced: null,
    };
    const result = getAssignedMembers(
      baseRule("round_robin", 1),
      kids,
      [],
      state,
    );
    expect(result[0].id).toBe(1);
  });

  it("round_robin with null state defaults to position 0", () => {
    const result = getAssignedMembers(
      baseRule("round_robin", 1),
      kids,
      [],
      null,
    );
    expect(result[0].id).toBe(1);
  });

  it("round_robin wraps around correctly", () => {
    const state: RotationState = {
      rule_id: 1,
      current_pos: 3,
      last_advanced: null,
    };
    const result = getAssignedMembers(
      baseRule("round_robin", 2),
      kids,
      [],
      state,
    );
    expect(result.map((m) => m.id)).toEqual([4, 1]);
  });
});
