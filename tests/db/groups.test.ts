import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { createTestDb } from "../helpers/db";
import {
  upsertGroup,
  findGroupByChatId,
  addMember,
  linkMember,
  findMemberByTelegramId,
  getActiveKids,
  getParents,
  getUnlinkedMembers,
  getAllGroups,
  resetGroup,
} from "../../src/db/groups";
import { createRule } from "../../src/db/rules";
import { createDuty } from "../../src/db/duties";

let db: Database.Database;

beforeEach(() => {
  db = createTestDb();
});
afterEach(() => db.close());

describe("groups", () => {
  it("upsertGroup creates a new group", () => {
    const g = upsertGroup(db, 100, "Сім'я Коваль");
    expect(g.chat_id).toBe(100);
    expect(g.name).toBe("Сім'я Коваль");
    expect(g.id).toBeGreaterThan(0);
  });

  it("upsertGroup updates name on conflict", () => {
    upsertGroup(db, 100, "Старе ім'я");
    const g = upsertGroup(db, 100, "Нове ім'я");
    expect(g.name).toBe("Нове ім'я");
  });

  it("findGroupByChatId returns null for unknown chat", () => {
    expect(findGroupByChatId(db, 999)).toBeNull();
  });

  it("getAllGroups returns all groups", () => {
    upsertGroup(db, 1, "А");
    upsertGroup(db, 2, "Б");
    expect(getAllGroups(db)).toHaveLength(2);
  });
});

describe("members", () => {
  let groupId: number;

  beforeEach(() => {
    groupId = upsertGroup(db, 100, "Test").id;
  });

  it("addMember creates a member", () => {
    const m = addMember(db, groupId, "Тато", "dad");
    expect(m.name).toBe("Тато");
    expect(m.role).toBe("dad");
    expect(m.telegram_id).toBeNull();
  });

  it("linkMember sets telegram_id", () => {
    const m = addMember(db, groupId, "Аня", "kid", 1);
    linkMember(db, m.id, 9999);
    const linked = findMemberByTelegramId(db, groupId, 9999);
    expect(linked?.id).toBe(m.id);
  });

  it("getActiveKids returns kids sorted by kid_order", () => {
    addMember(db, groupId, "Тато", "dad");
    addMember(db, groupId, "Іра", "kid", 2);
    addMember(db, groupId, "Олег", "kid", 1);
    const kids = getActiveKids(db, groupId);
    expect(kids.map((k) => k.name)).toEqual(["Олег", "Іра"]);
  });

  it("getParents returns dad and mom", () => {
    addMember(db, groupId, "Тато", "dad");
    addMember(db, groupId, "Мама", "mom");
    addMember(db, groupId, "Аня", "kid", 1);
    expect(getParents(db, groupId)).toHaveLength(2);
  });

  it("getUnlinkedMembers returns members without telegram_id", () => {
    const m1 = addMember(db, groupId, "Аня", "kid", 1);
    addMember(db, groupId, "Іра", "kid", 2);
    linkMember(db, m1.id, 5000);
    const unlinked = getUnlinkedMembers(db, groupId);
    expect(unlinked.map((m) => m.name)).toEqual(["Іра"]);
  });
});

describe("resetGroup", () => {
  it("removes group, members, rules, and duties", () => {
    const group = upsertGroup(db, 200, "Тест");
    const kid = addMember(db, group.id, "Аня", "kid", 1);
    const rule = createRule(db, group.id, "Завдання 1", "mon", 1, "all");
    createDuty(db, group.id, rule.id, kid.id, "2026-06-01");

    resetGroup(db, group.id);

    expect(findGroupByChatId(db, 200)).toBeNull();
    expect(
      db.prepare("SELECT * FROM members WHERE group_id = ?").all(group.id),
    ).toHaveLength(0);
    expect(
      db.prepare("SELECT * FROM work_rules WHERE group_id = ?").all(group.id),
    ).toHaveLength(0);
    expect(
      db.prepare("SELECT * FROM duties WHERE group_id = ?").all(group.id),
    ).toHaveLength(0);
  });
});
