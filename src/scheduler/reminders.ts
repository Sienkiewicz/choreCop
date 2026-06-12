import type { Telegraf, Telegram } from "telegraf";
import Database from "better-sqlite3";

interface BotLike {
  telegram: Telegram;
}
import { getAllGroups } from "../db/groups.js";
import { getDutiesForDate, getPendingDuties } from "../db/duties.js";
import { saveSummaryMessageId, getSummaryMessageId } from "../db/summaries.js";
import {
  buildSummaryMessage,
  buildReminderMessage,
} from "../bot/keyboards/duties.js";
import { trackAndPrune } from "../bot/helpers/messages.js";
import { toDateStr } from "./generate.js";

export async function sendDailySummary(
  bot: BotLike,
  db: Database.Database,
  date?: string,
): Promise<void> {
  const today = date ?? toDateStr(new Date());
  await Promise.all(
    getAllGroups(db).map(async (group) => {
      const duties = getDutiesForDate(db, group.id, today);
      if (duties.length === 0) return;

      const { text, reply_markup } = buildSummaryMessage(
        db,
        group.id,
        duties,
        today,
      );
      const existingMsgId = getSummaryMessageId(db, group.id, today);
      if (existingMsgId) {
        try {
          await bot.telegram.editMessageText(
            group.chat_id,
            existingMsgId,
            undefined,
            text,
            {
              reply_markup,
              parse_mode: "HTML",
            },
          );
          return;
        } catch {
          // Message gone — fall through to send a new one
        }
      }
      try {
        const msg = await bot.telegram.sendMessage(group.chat_id, text, {
          reply_markup,
          parse_mode: "HTML",
        });
        saveSummaryMessageId(db, group.id, today, msg.message_id);
        await bot.telegram.pinChatMessage(group.chat_id, msg.message_id, {
          disable_notification: true,
        });
      } catch (err) {
        console.error(
          `[reminders] failed to send summary to ${group.chat_id}:`,
          err,
        );
      }
    }),
  );
}

export async function sendReminder(
  bot: BotLike,
  db: Database.Database,
  date?: string,
): Promise<void> {
  const today = date ?? toDateStr(new Date());
  await Promise.all(
    getAllGroups(db).map(async (group) => {
      const pending = getPendingDuties(db, group.id, today);
      if (pending.length === 0) return;

      const { text, reply_markup } = buildReminderMessage(
        db,
        group.id,
        pending,
        today,
      );
      try {
        const msg = await bot.telegram.sendMessage(group.chat_id, text, {
          reply_markup,
          parse_mode: "HTML",
        });
        await trackAndPrune(
          bot.telegram,
          db,
          group.id,
          group.chat_id,
          msg.message_id,
        );
      } catch (err) {
        console.error(
          `[reminders] failed to send reminder to ${group.chat_id}:`,
          err,
        );
      }
    }),
  );
}

export async function updatePinnedSummary(
  bot: BotLike,
  db: Database.Database,
  groupId: number,
  chatId: number,
  date?: string,
): Promise<void> {
  const today = date ?? toDateStr(new Date());
  const msgId = getSummaryMessageId(db, groupId, today);
  if (!msgId) return;

  const duties = getDutiesForDate(db, groupId, today);
  const { text, reply_markup } = buildSummaryMessage(
    db,
    groupId,
    duties,
    today,
  );
  try {
    await bot.telegram.editMessageText(chatId, msgId, undefined, text, {
      reply_markup,
      parse_mode: "HTML",
    });
    if (duties.length > 0 && duties.every((d) => d.status === "done")) {
      await bot.telegram.unpinChatMessage(chatId, msgId);
    }
  } catch {
    // Message may be too old or unchanged — ignore
  }
}
