import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../helpers/db';
import {
  upsertFamily, findFamilyByChatId,
  addMember, linkMember,
  findMemberByTelegramId, getActiveKids,
  getParents, getUnlinkedMembers, getAllFamilies,
} from '../../src/db/families';

let db: Database.Database;

beforeEach(() => { db = createTestDb(); });
afterEach(() => db.close());

describe('families', () => {
  it('upsertFamily creates a new family', () => {
    const f = upsertFamily(db, 100, 'Сім\'я Коваль');
    expect(f.chat_id).toBe(100);
    expect(f.name).toBe('Сім\'я Коваль');
    expect(f.id).toBeGreaterThan(0);
  });

  it('upsertFamily updates name on conflict', () => {
    upsertFamily(db, 100, 'Старе ім\'я');
    const f = upsertFamily(db, 100, 'Нове ім\'я');
    expect(f.name).toBe('Нове ім\'я');
  });

  it('findFamilyByChatId returns null for unknown chat', () => {
    expect(findFamilyByChatId(db, 999)).toBeNull();
  });

  it('getAllFamilies returns all families', () => {
    upsertFamily(db, 1, 'А');
    upsertFamily(db, 2, 'Б');
    expect(getAllFamilies(db)).toHaveLength(2);
  });
});

describe('members', () => {
  let familyId: number;

  beforeEach(() => { familyId = upsertFamily(db, 100, 'Test').id; });

  it('addMember creates a member', () => {
    const m = addMember(db, familyId, 'Тато', 'dad');
    expect(m.name).toBe('Тато');
    expect(m.role).toBe('dad');
    expect(m.telegram_id).toBeNull();
  });

  it('linkMember sets telegram_id', () => {
    const m = addMember(db, familyId, 'Аня', 'kid', 1);
    linkMember(db, m.id, 9999);
    const linked = findMemberByTelegramId(db, familyId, 9999);
    expect(linked?.id).toBe(m.id);
  });

  it('getActiveKids returns kids sorted by kid_order', () => {
    addMember(db, familyId, 'Тато', 'dad');
    addMember(db, familyId, 'Іра', 'kid', 2);
    addMember(db, familyId, 'Олег', 'kid', 1);
    const kids = getActiveKids(db, familyId);
    expect(kids.map(k => k.name)).toEqual(['Олег', 'Іра']);
  });

  it('getParents returns dad and mom', () => {
    addMember(db, familyId, 'Тато', 'dad');
    addMember(db, familyId, 'Мама', 'mom');
    addMember(db, familyId, 'Аня', 'kid', 1);
    expect(getParents(db, familyId)).toHaveLength(2);
  });

  it('getUnlinkedMembers returns members without telegram_id', () => {
    const m1 = addMember(db, familyId, 'Аня', 'kid', 1);
    addMember(db, familyId, 'Іра', 'kid', 2);
    linkMember(db, m1.id, 5000);
    const unlinked = getUnlinkedMembers(db, familyId);
    expect(unlinked.map(m => m.name)).toEqual(['Іра']);
  });
});
