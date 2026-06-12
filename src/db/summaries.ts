import Database from "better-sqlite3";

export function saveSummaryMessageId(
  db: Database.Database,
  groupId: number,
  dutyDate: string,
  messageId: number,
): void {
  db.prepare(
    `
    INSERT INTO daily_summaries (group_id, duty_date, message_id)
    VALUES (?, ?, ?)
    ON CONFLICT(group_id, duty_date) DO UPDATE SET message_id = excluded.message_id
  `,
  ).run(groupId, dutyDate, messageId);
}

export function getSummaryMessageId(
  db: Database.Database,
  groupId: number,
  dutyDate: string,
): number | null {
  const row = db
    .prepare(
      "SELECT message_id FROM daily_summaries WHERE group_id = ? AND duty_date = ?",
    )
    .get(groupId, dutyDate) as { message_id: number } | undefined;
  return row?.message_id ?? null;
}
