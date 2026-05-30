import Database from 'better-sqlite3';
import { applySchema } from '../../src/db/schema.js';

export function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  applySchema(db);
  return db;
}
