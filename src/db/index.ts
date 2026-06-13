import Database from "better-sqlite3";
import path from "path";
import { applySchema } from "./schema";

const DB_PATH =
  process.env.DATABASE_PATH ?? path.join(process.cwd(), "chorecop.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    applySchema(_db);
  }
  return _db;
}

export function closeDb(): void {
  _db?.close();
  _db = null;
}
