import Database from "better-sqlite3";
import type { BotMessage } from "@src/types";

export function trackMessage(
  db: Database.Database,
  groupId: number,
  chatId: number,
  messageId: number,
): void {
  db.prepare(
    "INSERT INTO bot_messages (group_id, chat_id, message_id, created_at) VALUES (?, ?, ?, ?)",
  ).run(groupId, chatId, messageId, Date.now());
}

export function getMessagesToDelete(
  db: Database.Database,
  groupId: number,
  keepLast: number,
): BotMessage[] {
  return db
    .prepare(
      `
    SELECT * FROM bot_messages
    WHERE group_id = ?
    ORDER BY created_at DESC
    LIMIT -1 OFFSET ?
  `,
    )
    .all(groupId, keepLast) as BotMessage[];
}

export function deleteTrackedMessage(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM bot_messages WHERE id = ?").run(id);
}
