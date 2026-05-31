import type { Telegraf } from 'telegraf';
import Database from 'better-sqlite3';
import type { BotContext } from '../context.js';
import { generateDutiesForDate, toDateStr } from '../../scheduler/generate.js';
import { sendDailySummary, sendReminder, updatePinnedSummary } from '../../scheduler/reminders.js';
import {
  getDutiesForDate, getDutyById,
  markDone, requestApproval, approveOrReject,
} from '../../db/duties.js';
import { getAllMembers, getParents } from '../../db/families.js';
import { getActiveRules } from '../../db/rules.js';

function parseDate(args: string[]): { date: Date; dateStr: string } {
  const arg = args[0];
  const day = arg ? parseInt(arg, 10) : NaN;
  if (!isNaN(day) && day >= 1 && day <= 31) {
    const date = new Date();
    date.setDate(day);
    return { date, dateStr: toDateStr(date) };
  }
  const date = new Date();
  return { date, dateStr: toDateStr(date) };
}

const STATUS_ICON: Record<string, string> = {
  pending: '⬜',
  approval_pending: '⏳',
  done: '✅',
  rejected: '❌',
};

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

  bot.command('dev_list', async (ctx) => {
    if (!ctx.family || !ctx.chat) return;
    const args = ctx.message.text.split(' ').slice(1);
    const { dateStr } = parseDate(args);
    const duties = getDutiesForDate(db, ctx.family.id, dateStr);
    if (duties.length === 0) {
      await ctx.reply(`[DEV] No duties for ${dateStr}.`);
      return;
    }
    const members = Object.fromEntries(getAllMembers(db, ctx.family.id).map(m => [m.id, m.name]));
    const rules = Object.fromEntries(getActiveRules(db, ctx.family.id).map(r => [r.id, r.name]));
    const lines = duties.map(d =>
      `#${d.id} ${STATUS_ICON[d.status] ?? '?'} ${rules[d.rule_id] ?? '?'} → ${members[d.member_id] ?? '?'} [${d.status}]`
    );
    await ctx.reply(`[DEV] Duties for ${dateStr}:\n\n${lines.join('\n')}`);
  });

  bot.command('dev_done', async (ctx) => {
    if (!ctx.family || !ctx.chat) return;
    const id = parseInt(ctx.message.text.split(' ')[1] ?? '', 10);
    const duty = getDutyById(db, id);
    if (!duty || duty.family_id !== ctx.family.id) {
      await ctx.reply('[DEV] Duty not found.');
      return;
    }
    markDone(db, duty.id);
    await updatePinnedSummary(bot, db, ctx.family.id, ctx.chat.id);
    await ctx.reply(`✅ [DEV] Duty #${id} marked as done.`);
  });

  bot.command('dev_request', async (ctx) => {
    if (!ctx.family || !ctx.chat) return;
    const id = parseInt(ctx.message.text.split(' ')[1] ?? '', 10);
    const duty = getDutyById(db, id);
    if (!duty || duty.family_id !== ctx.family.id) {
      await ctx.reply('[DEV] Duty not found.');
      return;
    }
    const kids = getAllMembers(db, ctx.family.id).filter(m => m.role === 'kid' && m.id !== duty.member_id);
    const requester = kids[0];
    if (!requester) {
      await ctx.reply('[DEV] No other kid to simulate the request.');
      return;
    }
    requestApproval(db, duty.id, requester.id);
    await ctx.reply(`⏳ [DEV] Duty #${id} set to approval_pending (requested by ${requester.name}). Use /dev_approve or /dev_reject.`);
  });

  bot.command('dev_approve', async (ctx) => {
    if (!ctx.family || !ctx.chat) return;
    const id = parseInt(ctx.message.text.split(' ')[1] ?? '', 10);
    const duty = getDutyById(db, id);
    if (!duty || duty.family_id !== ctx.family.id) {
      await ctx.reply('[DEV] Duty not found.');
      return;
    }
    const parent = getParents(db, ctx.family.id)[0];
    if (!parent) {
      await ctx.reply('[DEV] No parent found to approve.');
      return;
    }
    approveOrReject(db, duty.id, parent.id, true);
    await updatePinnedSummary(bot, db, ctx.family.id, ctx.chat.id);
    await ctx.reply(`✅ [DEV] Duty #${id} approved by ${parent.name}.`);
  });

  bot.command('dev_reject', async (ctx) => {
    if (!ctx.family || !ctx.chat) return;
    const id = parseInt(ctx.message.text.split(' ')[1] ?? '', 10);
    const duty = getDutyById(db, id);
    if (!duty || duty.family_id !== ctx.family.id) {
      await ctx.reply('[DEV] Duty not found.');
      return;
    }
    const parent = getParents(db, ctx.family.id)[0];
    if (!parent) {
      await ctx.reply('[DEV] No parent found to reject.');
      return;
    }
    approveOrReject(db, duty.id, parent.id, false);
    await ctx.reply(`❌ [DEV] Duty #${id} rejected by ${parent.name} — back to pending.`);
  });
}
