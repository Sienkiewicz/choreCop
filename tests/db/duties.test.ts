import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../helpers/db';
import { upsertFamily, addMember } from '../../src/db/families';
import { createRule } from '../../src/db/rules';
import {
  createDuty, getDutiesForDate, getDutyById,
  markDone, requestApproval, approveOrReject,
  hasDutyForDate, getPendingDuties,
} from '../../src/db/duties';
import { getRotationState, upsertRotationState } from '../../src/db/rotation';
import { saveSummaryMessageId, getSummaryMessageId } from '../../src/db/summaries';

let db: Database.Database;
let familyId: number;
let memberId: number;
let parentId: number;
let ruleId: number;

beforeEach(() => {
  db = createTestDb();
  familyId = upsertFamily(db, 1, 'Test').id;
  memberId = addMember(db, familyId, 'Олег', 'kid', 1).id;
  parentId = addMember(db, familyId, 'Тато', 'dad').id;
  ruleId = createRule(db, familyId, 'Посудомийна', 'daily', 1, 'round_robin').id;
});
afterEach(() => db.close());

describe('duties', () => {
  it('createDuty inserts a pending duty', () => {
    const d = createDuty(db, familyId, ruleId, memberId, '2026-05-30');
    expect(d.status).toBe('pending');
    expect(d.duty_date).toBe('2026-05-30');
  });

  it('hasDutyForDate returns true after creation', () => {
    createDuty(db, familyId, ruleId, memberId, '2026-05-30');
    expect(hasDutyForDate(db, familyId, ruleId, '2026-05-30')).toBe(true);
    expect(hasDutyForDate(db, familyId, ruleId, '2026-05-31')).toBe(false);
  });

  it('markDone sets status to done', () => {
    const d = createDuty(db, familyId, ruleId, memberId, '2026-05-30');
    markDone(db, d.id);
    expect(getDutyById(db, d.id)?.status).toBe('done');
  });

  it('requestApproval sets status to approval_pending', () => {
    const d = createDuty(db, familyId, ruleId, memberId, '2026-05-30');
    requestApproval(db, d.id, parentId);
    const updated = getDutyById(db, d.id);
    expect(updated?.status).toBe('approval_pending');
    expect(updated?.requested_by).toBe(parentId);
  });

  it('approveOrReject approve sets done', () => {
    const d = createDuty(db, familyId, ruleId, memberId, '2026-05-30');
    requestApproval(db, d.id, parentId);
    approveOrReject(db, d.id, parentId, true);
    expect(getDutyById(db, d.id)?.status).toBe('done');
  });

  it('approveOrReject reject resets to pending', () => {
    const d = createDuty(db, familyId, ruleId, memberId, '2026-05-30');
    requestApproval(db, d.id, parentId);
    approveOrReject(db, d.id, parentId, false);
    const updated = getDutyById(db, d.id);
    expect(updated?.status).toBe('pending');
    expect(updated?.requested_by).toBeNull();
  });

  it('getPendingDuties returns pending and approval_pending', () => {
    const d1 = createDuty(db, familyId, ruleId, memberId, '2026-05-30');
    const d2 = createDuty(db, familyId, ruleId, memberId, '2026-05-30');
    markDone(db, d2.id);
    const pending = getPendingDuties(db, familyId, '2026-05-30');
    expect(pending.map(d => d.id)).toContain(d1.id);
    expect(pending.map(d => d.id)).not.toContain(d2.id);
  });
});

describe('rotation_state', () => {
  it('getRotationState returns null when no state exists', () => {
    expect(getRotationState(db, ruleId)).toBeNull();
  });

  it('upsertRotationState creates and updates', () => {
    upsertRotationState(db, ruleId, 2, '2026-05-30');
    expect(getRotationState(db, ruleId)?.current_pos).toBe(2);
    upsertRotationState(db, ruleId, 3, '2026-05-31');
    expect(getRotationState(db, ruleId)?.current_pos).toBe(3);
  });
});

describe('daily_summaries', () => {
  it('saves and retrieves summary message_id', () => {
    saveSummaryMessageId(db, familyId, '2026-05-30', 12345);
    expect(getSummaryMessageId(db, familyId, '2026-05-30')).toBe(12345);
  });

  it('returns null when no summary exists', () => {
    expect(getSummaryMessageId(db, familyId, '2026-05-30')).toBeNull();
  });
});
