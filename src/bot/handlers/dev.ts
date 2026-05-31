import type { Telegraf } from 'telegraf';
import Database from 'better-sqlite3';
import type { BotContext } from '../context.js';
import { getAllFamilies } from '../../db/families.js';
import { generateDutiesForDate } from '../../scheduler/generate.js';
import { sendDailySummary, sendReminder } from '../../scheduler/reminders.js';

export function registerDevHandlers(bot: Telegraf<BotContext>, db: Database.Database): void {
  bot.command('dev_generate', async (ctx) => {
    if (!ctx.family) return;
    generateDutiesForDate(db, ctx.family.id, new Date());
    await ctx.reply('✅ [DEV] Duties generated for today.');
  });

  bot.command('dev_summary', async (ctx) => {
    await sendDailySummary(bot, db);
    await ctx.reply('✅ [DEV] Daily summary sent.');
  });

  bot.command('dev_reminder', async (ctx) => {
    await sendReminder(bot, db);
    await ctx.reply('✅ [DEV] Reminder sent.');
  });

  bot.command('dev_cycle', async (ctx) => {
    if (!ctx.family) return;
    generateDutiesForDate(db, ctx.family.id, new Date());
    await sendDailySummary(bot, db);
    await ctx.reply('✅ [DEV] Full day cycle: generated duties + sent summary.');
  });
}
