import type { Telegraf } from 'telegraf';
import Database from 'better-sqlite3';
import type { BotContext } from '../context.js';
import { generateDutiesForDate, toDateStr } from '../../scheduler/generate.js';
import { sendDailySummary, sendReminder } from '../../scheduler/reminders.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(args: string[]): { date: Date; dateStr: string } {
  const arg = args[0];
  if (arg && DATE_RE.test(arg)) {
    const date = new Date(arg);
    return { date, dateStr: arg };
  }
  const date = new Date();
  return { date, dateStr: toDateStr(date) };
}

export function registerDevHandlers(bot: Telegraf<BotContext>, db: Database.Database): void {
  bot.command('dev_generate', async (ctx) => {
    if (!ctx.family) return;
    const args = ctx.message.text.split(' ').slice(1);
    const { date, dateStr } = parseDate(args);
    generateDutiesForDate(db, ctx.family.id, date);
    await ctx.reply(`✅ [DEV] Duties generated for ${dateStr}.`);
  });

  bot.command('dev_summary', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    const { dateStr } = parseDate(args);
    await sendDailySummary(bot, db, dateStr);
    await ctx.reply(`✅ [DEV] Daily summary sent for ${dateStr}.`);
  });

  bot.command('dev_reminder', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    const { dateStr } = parseDate(args);
    await sendReminder(bot, db, dateStr);
    await ctx.reply(`✅ [DEV] Reminder sent for ${dateStr}.`);
  });

  bot.command('dev_cycle', async (ctx) => {
    if (!ctx.family) return;
    const args = ctx.message.text.split(' ').slice(1);
    const { date, dateStr } = parseDate(args);
    generateDutiesForDate(db, ctx.family.id, date);
    await sendDailySummary(bot, db, dateStr);
    await ctx.reply(`✅ [DEV] Full day cycle for ${dateStr}: generated duties + sent summary.`);
  });
}
