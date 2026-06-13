import Database from "better-sqlite3";
import type { Group, Member } from "../types.js";
import { Gender } from "../types.js";

export function upsertGroup(
  db: Database.Database,
  chatId: number,
  name: string,
): Group {
  db.prepare(
    `
    INSERT INTO groups (chat_id, name, created_at)
    VALUES (?, ?, ?)
    ON CONFLICT(chat_id) DO UPDATE SET name = excluded.name
  `,
  ).run(chatId, name, Date.now());
  return db
    .prepare("SELECT * FROM groups WHERE chat_id = ?")
    .get(chatId) as Group;
}

export function findGroupByChatId(
  db: Database.Database,
  chatId: number,
): Group | null {
  return (
    (db
      .prepare("SELECT * FROM groups WHERE chat_id = ?")
      .get(chatId) as Group) ?? null
  );
}

export function findGroupById(db: Database.Database, id: number): Group | null {
  return (
    (db.prepare("SELECT * FROM groups WHERE id = ?").get(id) as Group) ?? null
  );
}

export function getAllGroups(db: Database.Database): Group[] {
  return db.prepare("SELECT * FROM groups").all() as Group[];
}

export function findMemberWithGroupByTelegramId(
  db: Database.Database,
  telegramId: number,
): { member: Member; group: Group } | null {
  const member = db
    .prepare(
      "SELECT * FROM members WHERE telegram_id = ? AND active = 1 LIMIT 1",
    )
    .get(telegramId) as Member | undefined;
  if (!member) return null;
  const group = db
    .prepare("SELECT * FROM groups WHERE id = ?")
    .get(member.group_id) as Group | undefined;
  if (!group) return null;
  return { member, group };
}

export function addMember(
  db: Database.Database,
  groupId: number,
  name: string,
  role: Member["role"],
  kidOrder?: number,
  username?: string,
  gender: Member["gender"] = Gender.Male,
): Member {
  const result = db
    .prepare(
      `
    INSERT INTO members (group_id, name, role, kid_order, username, gender, active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `,
    )
    .run(groupId, name, role, kidOrder ?? null, username ?? null, gender);
  return db
    .prepare("SELECT * FROM members WHERE id = ?")
    .get(result.lastInsertRowid) as Member;
}

export function findMemberByUsername(
  db: Database.Database,
  groupId: number,
  username: string,
): Member | null {
  return (
    (db
      .prepare(
        "SELECT * FROM members WHERE group_id = ? AND username = ? AND active = 1",
      )
      .get(groupId, username) as Member) ?? null
  );
}

export function linkMember(
  db: Database.Database,
  memberId: number,
  telegramId: number,
): void {
  db.prepare("UPDATE members SET telegram_id = ? WHERE id = ?").run(
    telegramId,
    memberId,
  );
}

export function findMemberByTelegramId(
  db: Database.Database,
  groupId: number,
  telegramId: number,
): Member | null {
  return (
    (db
      .prepare("SELECT * FROM members WHERE group_id = ? AND telegram_id = ?")
      .get(groupId, telegramId) as Member) ?? null
  );
}

export function getActiveKids(
  db: Database.Database,
  groupId: number,
): Member[] {
  return db
    .prepare(
      `
    SELECT * FROM members
    WHERE group_id = ? AND role = 'kid' AND active = 1
    ORDER BY kid_order
  `,
    )
    .all(groupId) as Member[];
}

export function getParents(db: Database.Database, groupId: number): Member[] {
  return db
    .prepare(
      `
    SELECT * FROM members
    WHERE group_id = ? AND role IN ('dad','mom') AND active = 1
  `,
    )
    .all(groupId) as Member[];
}

export function getUnlinkedMembers(
  db: Database.Database,
  groupId: number,
): Member[] {
  return db
    .prepare(
      "SELECT * FROM members WHERE group_id = ? AND telegram_id IS NULL AND active = 1",
    )
    .all(groupId) as Member[];
}

export function getAllMembers(
  db: Database.Database,
  groupId: number,
): Member[] {
  return db
    .prepare("SELECT * FROM members WHERE group_id = ? AND active = 1")
    .all(groupId) as Member[];
}

function deleteGroupData(db: Database.Database, groupId: number): void {
  db.prepare("DELETE FROM duties WHERE group_id = ?").run(groupId);
  db.prepare("DELETE FROM daily_summaries WHERE group_id = ?").run(groupId);
  db.prepare("DELETE FROM bot_messages WHERE group_id = ?").run(groupId);
  const ruleIds = (
    db.prepare("SELECT id FROM work_rules WHERE group_id = ?").all(groupId) as {
      id: number;
    }[]
  ).map((r) => r.id);
  ruleIds.forEach((id) => {
    db.prepare("DELETE FROM rotation_state WHERE rule_id = ?").run(id);
    db.prepare("DELETE FROM fixed_assignments WHERE rule_id = ?").run(id);
  });
  db.prepare("DELETE FROM work_rules WHERE group_id = ?").run(groupId);
  db.prepare("DELETE FROM members WHERE group_id = ?").run(groupId);
}

export function clearGroup(db: Database.Database, groupId: number): void {
  db.transaction(() => deleteGroupData(db, groupId))();
}

export function resetGroup(db: Database.Database, groupId: number): void {
  db.transaction(() => {
    deleteGroupData(db, groupId);
    db.prepare("DELETE FROM groups WHERE id = ?").run(groupId);
  })();
}
