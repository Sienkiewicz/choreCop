import type { Telegram } from "telegraf";
import Database from "better-sqlite3";
import {
  trackMessage,
  getMessagesToDelete,
  deleteTrackedMessage,
} from "../../db/messages.js";

const KEEP_LAST = 4;

export async function trackAndPrune(
  telegram: Telegram,
  db: Database.Database,
  groupId: number,
  chatId: number,
  messageId: number,
): Promise<void> {
  trackMessage(db, groupId, chatId, messageId);
  const old = getMessagesToDelete(db, groupId, KEEP_LAST);
  for (const msg of old) {
    try {
      await telegram.deleteMessage(msg.chat_id, msg.message_id);
    } catch {
      /* already deleted or too old to delete */
    }
    deleteTrackedMessage(db, msg.id);
  }
}
