import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { createTestDb } from "../helpers/db";
import { upsertGroup, addMember } from "../../src/db/groups";
import { createRule, setFixedAssignments } from "../../src/db/rules";
import { getDutiesForDate } from "../../src/db/duties";
import { getRotationState } from "../../src/db/rotation";
import { generateDutiesForDate, toDateStr } from "../../src/scheduler/generate";

let db: Database.Database;
let groupId: number;
let kid1Id: number;
let kid2Id: number;
let kid3Id: number;
let kid4Id: number;

beforeEach(() => {
  db = createTestDb();
  groupId = upsertGroup(db, 1, "Test").id;
  kid1Id = addMember(db, groupId, "Олег", "kid", 1).id;
  kid2Id = addMember(db, groupId, "Аня", "kid", 2).id;
  kid3Id = addMember(db, groupId, "Іра", "kid", 3).id;
  kid4Id = addMember(db, groupId, "Том", "kid", 4).id;
});
afterEach(() => {
  db.close();
});

const SAT = new Date("2026-05-30");
const MON = new Date("2026-06-01");

describe("generateDutiesForDate", () => {
  it("creates duties for matching rules", () => {
    createRule(db, groupId, "Посудомийна", "daily", 1, "round_robin");
    generateDutiesForDate(db, groupId, MON);
    const duties = getDutiesForDate(db, groupId, toDateStr(MON));
    expect(duties).toHaveLength(1);
    expect(duties[0].member_id).toBe(kid1Id);
  });

  it("skips rules that do not match the day", () => {
    createRule(db, groupId, "Прибирання", "sat", 4, "all");
    generateDutiesForDate(db, groupId, MON);
    expect(getDutiesForDate(db, groupId, toDateStr(MON))).toHaveLength(0);
  });

  it("is idempotent — running twice does not create duplicates", () => {
    createRule(db, groupId, "Посудомийна", "daily", 1, "round_robin");
    generateDutiesForDate(db, groupId, MON);
    generateDutiesForDate(db, groupId, MON);
    expect(getDutiesForDate(db, groupId, toDateStr(MON))).toHaveLength(1);
  });

  it("all mode creates duties for all 4 kids on saturday", () => {
    createRule(db, groupId, "Прибирання повне", "sat", 4, "all");
    generateDutiesForDate(db, groupId, SAT);
    expect(getDutiesForDate(db, groupId, toDateStr(SAT))).toHaveLength(4);
  });

  it("fixed mode creates duties for fixed kids only", () => {
    const rule = createRule(
      db,
      groupId,
      "Прибирання легке",
      "tue,thu",
      2,
      "fixed",
    );
    setFixedAssignments(db, rule.id, [kid1Id, kid2Id]);
    const TUE = new Date("2026-06-02");
    generateDutiesForDate(db, groupId, TUE);
    const duties = getDutiesForDate(db, groupId, toDateStr(TUE));
    expect(duties).toHaveLength(2);
    expect(duties.map((d) => d.member_id).sort()).toEqual(
      [kid1Id, kid2Id].sort(),
    );
  });

  it("round_robin advances rotation state after generation", () => {
    const rule = createRule(
      db,
      groupId,
      "Посудомийна",
      "daily",
      1,
      "round_robin",
    );
    generateDutiesForDate(db, groupId, MON);
    const state = getRotationState(db, rule.id);
    expect(state?.current_pos).toBe(1);
  });

  it("round_robin cycles through kids over multiple days", () => {
    createRule(db, groupId, "Посудомийна", "daily", 1, "round_robin");
    const dates = [
      new Date("2026-06-01"),
      new Date("2026-06-02"),
      new Date("2026-06-03"),
      new Date("2026-06-04"),
    ];
    for (const d of dates) generateDutiesForDate(db, groupId, d);
    const allDuties = dates.flatMap((d) =>
      getDutiesForDate(db, groupId, toDateStr(d)),
    );
    expect(allDuties.map((d) => d.member_id)).toEqual([
      kid1Id,
      kid2Id,
      kid3Id,
      kid4Id,
    ]);
  });
});
