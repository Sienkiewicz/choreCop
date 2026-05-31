import type { Telegraf, Telegram } from 'telegraf';
import Database from 'better-sqlite3';

interface BotLike {
  telegram: Telegram;
}
import { getAllFamilies } from '../db/families.js';
import { getDutiesForDate, getPendingDuties } from '../db/duties.js';
import { saveSummaryMessageId, getSummaryMessageId } from '../db/summaries.js';
import { buildSummaryMessage, buildReminderMessage } from '../bot/keyboards/duties.js';
import { toDateStr } from './generate.js';

export async function sendDailySummary(bot: BotLike, db: Database.Database): Promise<void> {
  const today = toDateStr(new Date());
  for (const family of getAllFamilies(db)) {
    const duties = getDutiesForDate(db, family.id, today);
    if (duties.length === 0) continue;

    const { text, reply_markup } = buildSummaryMessage(db, family.id, duties, today);
    try {
      const msg = await bot.telegram.sendMessage(family.chat_id, text, {
        reply_markup,
        parse_mode: 'HTML',
      });
      saveSummaryMessageId(db, family.id, today, msg.message_id);
      await bot.telegram.pinChatMessage(family.chat_id, msg.message_id, {
        disable_notification: true,
      });
    } catch (err) {
      console.error(`[reminders] failed to send summary to ${family.chat_id}:`, err);
    }
  }
}

export async function sendReminder(bot: BotLike, db: Database.Database): Promise<void> {
  const today = toDateStr(new Date());
  for (const family of getAllFamilies(db)) {
    const pending = getPendingDuties(db, family.id, today);
    if (pending.length === 0) continue;

    const { text, reply_markup } = buildReminderMessage(db, family.id, pending, today);
    try {
      await bot.telegram.sendMessage(family.chat_id, text, {
        reply_markup,
        parse_mode: 'HTML',
      });
    } catch (err) {
      console.error(`[reminders] failed to send reminder to ${family.chat_id}:`, err);
    }
  }
}

export async function updatePinnedSummary(
  bot: BotLike,
  db: Database.Database,
  familyId: number,
  chatId: number,
): Promise<void> {
  const today = toDateStr(new Date());
  const msgId = getSummaryMessageId(db, familyId, today);
  if (!msgId) return;

  const duties = getDutiesForDate(db, familyId, today);
  const { text, reply_markup } = buildSummaryMessage(db, familyId, duties, today);
  try {
    await bot.telegram.editMessageText(chatId, msgId, undefined, text, {
      reply_markup,
      parse_mode: 'HTML',
    });
    if (duties.length > 0 && duties.every(d => d.status === 'done')) {
      await bot.telegram.unpinChatMessage(chatId, msgId);
    }
  } catch {
    // Message may be too old or unchanged — ignore
  }
}
