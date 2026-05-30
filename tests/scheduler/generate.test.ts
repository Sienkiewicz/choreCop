import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../helpers/db';
import { upsertFamily, addMember } from '../../src/db/families';
import { createRule, setFixedAssignments } from '../../src/db/rules';
import { getDutiesForDate } from '../../src/db/duties';
import { getRotationState } from '../../src/db/rotation';
import { generateDutiesForDate, toDateStr } from '../../src/scheduler/generate';

let db: Database.Database;
let familyId: number;
let kid1Id: number;
let kid2Id: number;
let kid3Id: number;
let kid4Id: number;

beforeEach(() => {
  db = createTestDb();
  familyId = upsertFamily(db, 1, 'Test').id;
  kid1Id = addMember(db, familyId, 'Олег', 'kid', 1).id;
  kid2Id = addMember(db, familyId, 'Аня',  'kid', 2).id;
  kid3Id = addMember(db, familyId, 'Іра',  'kid', 3).id;
  kid4Id = addMember(db, familyId, 'Том',  'kid', 4).id;
});
afterEach(() => db.close());

const SAT = new Date('2026-05-30');
const MON = new Date('2026-06-01');

describe('generateDutiesForDate', () => {
  it('creates duties for matching rules', () => {
    createRule(db, familyId, 'Посудомийна', 'daily', 1, 'round_robin');
    generateDutiesForDate(db, familyId, MON);
    const duties = getDutiesForDate(db, familyId, toDateStr(MON));
    expect(duties).toHaveLength(1);
    expect(duties[0].member_id).toBe(kid1Id);
  });

  it('skips rules that do not match the day', () => {
    createRule(db, familyId, 'Прибирання', 'sat', 4, 'all');
    generateDutiesForDate(db, familyId, MON);
    expect(getDutiesForDate(db, familyId, toDateStr(MON))).toHaveLength(0);
  });

  it('is idempotent — running twice does not create duplicates', () => {
    createRule(db, familyId, 'Посудомийна', 'daily', 1, 'round_robin');
    generateDutiesForDate(db, familyId, MON);
    generateDutiesForDate(db, familyId, MON);
    expect(getDutiesForDate(db, familyId, toDateStr(MON))).toHaveLength(1);
  });

  it('all mode creates duties for all 4 kids on saturday', () => {
    createRule(db, familyId, 'Прибирання повне', 'sat', 4, 'all');
    generateDutiesForDate(db, familyId, SAT);
    expect(getDutiesForDate(db, familyId, toDateStr(SAT))).toHaveLength(4);
  });

  it('fixed mode creates duties for fixed kids only', () => {
    const rule = createRule(db, familyId, 'Прибирання легке', 'tue,thu', 2, 'fixed');
    setFixedAssignments(db, rule.id, [kid1Id, kid2Id]);
    const TUE = new Date('2026-06-02');
    generateDutiesForDate(db, familyId, TUE);
    const duties = getDutiesForDate(db, familyId, toDateStr(TUE));
    expect(duties).toHaveLength(2);
    expect(duties.map(d => d.member_id).sort()).toEqual([kid1Id, kid2Id].sort());
  });

  it('round_robin advances rotation state after generation', () => {
    const rule = createRule(db, familyId, 'Посудомийна', 'daily', 1, 'round_robin');
    generateDutiesForDate(db, familyId, MON);
    const state = getRotationState(db, rule.id);
    expect(state?.current_pos).toBe(1);
  });

  it('round_robin cycles through kids over multiple days', () => {
    createRule(db, familyId, 'Посудомийна', 'daily', 1, 'round_robin');
    const dates = [
      new Date('2026-06-01'),
      new Date('2026-06-02'),
      new Date('2026-06-03'),
      new Date('2026-06-04'),
    ];
    for (const d of dates) generateDutiesForDate(db, familyId, d);
    const allDuties = dates.flatMap(d =>
      getDutiesForDate(db, familyId, toDateStr(d))
    );
    expect(allDuties.map(d => d.member_id)).toEqual([kid1Id, kid2Id, kid3Id, kid4Id]);
  });
});
