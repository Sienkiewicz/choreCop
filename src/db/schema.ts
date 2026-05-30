import Database from 'better-sqlite3';

export function applySchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS families (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id    INTEGER UNIQUE NOT NULL,
      name       TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS members (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id   INTEGER NOT NULL REFERENCES families(id),
      telegram_id INTEGER,
      name        TEXT NOT NULL,
      role        TEXT NOT NULL CHECK(role IN ('dad','mom','kid')),
      kid_order   INTEGER,
      active      INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS work_rules (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id      INTEGER NOT NULL REFERENCES families(id),
      name           TEXT NOT NULL,
      schedule       TEXT NOT NULL,
      workers_count  INTEGER NOT NULL,
      rotation_mode  TEXT NOT NULL CHECK(rotation_mode IN ('round_robin','fixed','all')),
      active         INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS fixed_assignments (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id   INTEGER NOT NULL REFERENCES work_rules(id),
      member_id INTEGER NOT NULL REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS rotation_state (
      rule_id       INTEGER UNIQUE NOT NULL REFERENCES work_rules(id),
      current_pos   INTEGER NOT NULL DEFAULT 0,
      last_advanced TEXT
    );

    CREATE TABLE IF NOT EXISTS duties (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id    INTEGER NOT NULL REFERENCES families(id),
      rule_id      INTEGER NOT NULL REFERENCES work_rules(id),
      member_id    INTEGER NOT NULL REFERENCES members(id),
      duty_date    TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'pending'
                   CHECK(status IN ('pending','approval_pending','done','rejected')),
      requested_by INTEGER REFERENCES members(id),
      approved_by  INTEGER REFERENCES members(id),
      done_at      INTEGER,
      created_at   INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_summaries (
      family_id  INTEGER NOT NULL REFERENCES families(id),
      duty_date  TEXT NOT NULL,
      message_id INTEGER NOT NULL,
      PRIMARY KEY (family_id, duty_date)
    );
  `);
}
