import Database from 'better-sqlite3';
import type { Family, Member } from '../types.js';

export function upsertFamily(db: Database.Database, chatId: number, name: string): Family {
  db.prepare(`
    INSERT INTO families (chat_id, name, created_at)
    VALUES (?, ?, ?)
    ON CONFLICT(chat_id) DO UPDATE SET name = excluded.name
  `).run(chatId, name, Date.now());
  return db.prepare('SELECT * FROM families WHERE chat_id = ?').get(chatId) as Family;
}

export function findFamilyByChatId(db: Database.Database, chatId: number): Family | null {
  return (db.prepare('SELECT * FROM families WHERE chat_id = ?').get(chatId) as Family) ?? null;
}

export function getAllFamilies(db: Database.Database): Family[] {
  return db.prepare('SELECT * FROM families').all() as Family[];
}

export function addMember(
  db: Database.Database,
  familyId: number,
  name: string,
  role: Member['role'],
  kidOrder?: number,
): Member {
  const result = db.prepare(`
    INSERT INTO members (family_id, name, role, kid_order, active)
    VALUES (?, ?, ?, ?, 1)
  `).run(familyId, name, role, kidOrder ?? null);
  return db.prepare('SELECT * FROM members WHERE id = ?').get(result.lastInsertRowid) as Member;
}

export function linkMember(db: Database.Database, memberId: number, telegramId: number): void {
  db.prepare('UPDATE members SET telegram_id = ? WHERE id = ?').run(telegramId, memberId);
}

export function findMemberByTelegramId(db: Database.Database, familyId: number, telegramId: number): Member | null {
  return (db.prepare(
    'SELECT * FROM members WHERE family_id = ? AND telegram_id = ?'
  ).get(familyId, telegramId) as Member) ?? null;
}

export function getActiveKids(db: Database.Database, familyId: number): Member[] {
  return db.prepare(`
    SELECT * FROM members
    WHERE family_id = ? AND role = 'kid' AND active = 1
    ORDER BY kid_order
  `).all(familyId) as Member[];
}

export function getParents(db: Database.Database, familyId: number): Member[] {
  return db.prepare(`
    SELECT * FROM members
    WHERE family_id = ? AND role IN ('dad','mom') AND active = 1
  `).all(familyId) as Member[];
}

export function getUnlinkedMembers(db: Database.Database, familyId: number): Member[] {
  return db.prepare(
    'SELECT * FROM members WHERE family_id = ? AND telegram_id IS NULL AND active = 1'
  ).all(familyId) as Member[];
}

export function getAllMembers(db: Database.Database, familyId: number): Member[] {
  return db.prepare('SELECT * FROM members WHERE family_id = ? AND active = 1').all(familyId) as Member[];
}

export function resetFamily(db: Database.Database, familyId: number): void {
  db.transaction(() => {
    db.prepare('DELETE FROM daily_summaries WHERE family_id = ?').run(familyId);
    db.prepare('DELETE FROM duties WHERE family_id = ?').run(familyId);
    const ruleIds = (db.prepare('SELECT id FROM work_rules WHERE family_id = ?').all(familyId) as { id: number }[]).map(r => r.id);
    ruleIds.forEach(id => {
      db.prepare('DELETE FROM rotation_state WHERE rule_id = ?').run(id);
      db.prepare('DELETE FROM fixed_assignments WHERE rule_id = ?').run(id);
    });
    db.prepare('DELETE FROM work_rules WHERE family_id = ?').run(familyId);
    db.prepare('DELETE FROM members WHERE family_id = ?').run(familyId);
    db.prepare('DELETE FROM families WHERE id = ?').run(familyId);
  })();
}
