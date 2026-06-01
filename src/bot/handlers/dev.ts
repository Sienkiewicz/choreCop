import type { Telegraf } from 'telegraf';
import Database from 'better-sqlite3';
import type { BotContext } from '../context.js';
import { generateDutiesForDate, toDateStr } from '../../scheduler/generate.js';
import { sendDailySummary, sendReminder, updatePinnedSummary } from '../../scheduler/reminders.js';
import {
  getDutiesForDate, getDutyById,
  markDone, requestApproval, approveOrReject,
} from '../../db/duties.js';
import { getAllMembers, getParents, upsertFamily, addMember, linkMember, getActiveKids } from '../../db/families.js';
import { getActiveRules, createRule } from '../../db/rules.js';
import type { WorkRule } from '../../types.js';

function parseDate(args: string[]): { date: Date; dateStr: string } {
  const arg = args[0];
  if (arg && /^\d{2}-\d{2}-\d{4}$/.test(arg)) {
    const [dd, mm, yyyy] = arg.split('-');
    const date = new Date(`${yyyy}-${mm}-${dd}`);
    if (!isNaN(date.getTime())) return { date, dateStr: `${yyyy}-${mm}-${dd}` };
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
  bot.command('dev_setup', async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    const groupName = 'title' in ctx.chat ? ctx.chat.title : 'Test Family';
    const family = upsertFamily(db, ctx.chat.id, groupName);
    const existing = getAllMembers(db, family.id).find(m => m.telegram_id === ctx.from!.id);
    if (existing) {
      await ctx.reply(`[DEV] Family already exists. You are "${existing.name}" (${existing.role}).`);
      return;
    }
    const dad = addMember(db, family.id, ctx.from.first_name, 'dad');
    linkMember(db, dad.id, ctx.from.id);
    await ctx.reply(`[DEV] Family "${groupName}" created. You are dad (${ctx.from.first_name}).`);
  });

  bot.command('dev_add_member', async (ctx) => {
    if (!ctx.family) { await ctx.reply('[DEV] Run /dev_setup first.'); return; }
    const args = ctx.message.text.split(' ').slice(1);
    const role = args[args.length - 1] as 'mom' | 'kid';
    if (!['mom', 'kid'].includes(role)) {
      await ctx.reply('[DEV] Usage: /dev_add_member <name> <mom|kid>');
      return;
    }
    const name = args.slice(0, -1).join(' ');
    if (!name) { await ctx.reply('[DEV] Usage: /dev_add_member <name> <mom|kid>'); return; }
    const kidOrder = role === 'kid' ? getActiveKids(db, ctx.family.id).length + 1 : undefined;
    const member = addMember(db, ctx.family.id, name, role, kidOrder);
    await ctx.reply(`[DEV] Added "${member.name}" as ${member.role}.`);
  });

  bot.command('dev_add_rule', async (ctx) => {
    if (!ctx.family) { await ctx.reply('[DEV] Run /dev_setup first.'); return; }
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 4) {
      await ctx.reply('[DEV] Usage: /dev_add_rule <name> <schedule> <workers> <round_robin|all|fixed>\nExample: /dev_add_rule Dishes daily 1 round_robin');
      return;
    }
    const mode = args[args.length - 1] as WorkRule['rotation_mode'];
    const workers = parseInt(args[args.length - 2], 10);
    const schedule = args[args.length - 3];
    const name = args.slice(0, -3).join(' ');
    if (!['round_robin', 'all', 'fixed'].includes(mode) || isNaN(workers)) {
      await ctx.reply('[DEV] Invalid args. Mode must be round_robin|all|fixed.');
      return;
    }
    const rule = createRule(db, ctx.family.id, name, schedule, workers, mode);
    await ctx.reply(`[DEV] Rule "${rule.name}" created — ${schedule}, ${workers} worker(s), ${mode}.`);
  });

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
