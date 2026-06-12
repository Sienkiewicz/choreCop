import Database from "better-sqlite3";

export function applySchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id    INTEGER UNIQUE NOT NULL,
      name       TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS members (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id    INTEGER NOT NULL REFERENCES groups(id),
      telegram_id INTEGER,
      username    TEXT,
      name        TEXT NOT NULL,
      role        TEXT NOT NULL CHECK(role IN ('dad','mom','kid')),
      gender      TEXT NOT NULL DEFAULT 'male',
      kid_order   INTEGER,
      active      INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS work_rules (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id       INTEGER NOT NULL REFERENCES groups(id),
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
      group_id     INTEGER NOT NULL REFERENCES groups(id),
      rule_id      INTEGER NOT NULL REFERENCES work_rules(id),
      member_id    INTEGER NOT NULL REFERENCES members(id),
      duty_date    TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'pending'
                   CHECK(status IN ('pending','approval_pending','done','rejected')),
      requested_by INTEGER REFERENCES members(id),
      approved_by  INTEGER REFERENCES members(id),
      done_by      INTEGER REFERENCES members(id),
      done_at      INTEGER,
      created_at   INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_summaries (
      group_id   INTEGER NOT NULL REFERENCES groups(id),
      duty_date  TEXT NOT NULL,
      message_id INTEGER NOT NULL,
      PRIMARY KEY (group_id, duty_date)
    );

    CREATE TABLE IF NOT EXISTS bot_messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id   INTEGER NOT NULL REFERENCES groups(id),
      chat_id    INTEGER NOT NULL,
      message_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  try {
    db.exec("ALTER TABLE members ADD COLUMN username TEXT;");
  } catch {
    /* exists */
  }
  try {
    db.exec(
      "ALTER TABLE members ADD COLUMN gender TEXT NOT NULL DEFAULT 'male';",
    );
  } catch {
    /* exists */
  }
  try {
    db.exec(
      "ALTER TABLE duties ADD COLUMN done_by INTEGER REFERENCES members(id);",
    );
  } catch {
    /* exists */
  }
}
