import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { applySchema } from '../../src/db/schema';

let db: Database.Database;

beforeEach(() => {
  db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
});

afterEach(() => db.close());

describe('applySchema', () => {
  it('creates all required tables', () => {
    applySchema(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r: any) => r.name);
    expect(tables).toContain('families');
    expect(tables).toContain('members');
    expect(tables).toContain('work_rules');
    expect(tables).toContain('fixed_assignments');
    expect(tables).toContain('rotation_state');
    expect(tables).toContain('duties');
    expect(tables).toContain('daily_summaries');
  });

  it('is idempotent — running twice does not error', () => {
    expect(() => { applySchema(db); applySchema(db); }).not.toThrow();
  });
});
