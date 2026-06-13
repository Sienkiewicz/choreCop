import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { createTestDb } from "../helpers/db";
import { upsertGroup, addMember } from "@src/db/groups";
import {
  createRule,
  getActiveRules,
  setFixedAssignments,
  getFixedAssignments,
} from "@src/db/rules";

let db: Database.Database;
let groupId: number;
let kidId: number;

beforeEach(() => {
  db = createTestDb();
  groupId = upsertGroup(db, 1, "Test").id;
  kidId = addMember(db, groupId, "Аня", "kid", 1).id;
});
afterEach(() => {
  db.close();
});

describe("createRule", () => {
  it("creates a work rule", () => {
    const rule = createRule(
      db,
      groupId,
      "Посудомийна",
      "daily",
      1,
      "round_robin",
    );
    expect(rule.name).toBe("Посудомийна");
    expect(rule.schedule).toBe("daily");
    expect(rule.rotation_mode).toBe("round_robin");
    expect(rule.active).toBe(1);
  });
});

describe("getActiveRules", () => {
  it("returns only active rules for the group", () => {
    createRule(db, groupId, "A", "daily", 1, "round_robin");
    createRule(db, groupId, "B", "sat", 4, "all");
    const rules = getActiveRules(db, groupId);
    expect(rules).toHaveLength(2);
  });
});

describe("setFixedAssignments", () => {
  it("sets and replaces fixed assignments", () => {
    const rule = createRule(db, groupId, "Прибирання", "tue,thu", 1, "fixed");
    setFixedAssignments(db, rule.id, [kidId]);
    expect(getFixedAssignments(db, rule.id)).toHaveLength(1);
    setFixedAssignments(db, rule.id, []);
    expect(getFixedAssignments(db, rule.id)).toHaveLength(0);
  });
});
