import type { Telegraf } from "telegraf";
import Database from "better-sqlite3";
import type { BotContext } from "../context";
import { generateDutiesForDate, toDateStr } from "@src/scheduler/generate";
import {
  sendDailySummary,
  sendReminder,
  updatePinnedSummary,
} from "@src/scheduler/reminders";
import {
  getDutiesForDate,
  getDutyById,
  markDone,
  requestApproval,
  approveOrReject,
} from "@src/db/duties";
import { getAllMembers, getParents } from "@src/db/groups";
import { getActiveRules } from "@src/db/rules";
import { Role, DutyStatus } from "@src/types";

function parseDate(args: string[]): { date: Date; dateStr: string } {
  const arg = args[0];
  if (arg && /^\d{2}-\d{2}-\d{4}$/.test(arg)) {
    const [dd, mm, yyyy] = arg.split("-");
    const date = new Date(`${yyyy}-${mm}-${dd}`);
    if (!isNaN(date.getTime())) return { date, dateStr: `${yyyy}-${mm}-${dd}` };
  }
  const date = new Date();
  return { date, dateStr: toDateStr(date) };
}

const STATUS_ICON: Record<string, string> = {
  [DutyStatus.Pending]: "⬜",
  [DutyStatus.ApprovalPending]: "⏳",
  [DutyStatus.Done]: "✅",
  [DutyStatus.Rejected]: "❌",
};

export function registerDevHandlers(
  bot: Telegraf<BotContext>,
  db: Database.Database,
): void {
  bot.command("dev_generate", async (ctx) => {
    if (!ctx.group) return;
    const args = ctx.message.text.split(" ").slice(1);
    const { date, dateStr } = parseDate(args);
    generateDutiesForDate(db, ctx.group.id, date);
    await ctx.reply(`✅ [DEV] Duties generated for ${dateStr}.`);
  });

  bot.command("dev_summary", async (ctx) => {
    const args = ctx.message.text.split(" ").slice(1);
    const { dateStr } = parseDate(args);
    await sendDailySummary(bot, db, dateStr);
    await ctx.reply(`✅ [DEV] Daily summary sent for ${dateStr}.`);
  });

  bot.command("dev_reminder", async (ctx) => {
    const args = ctx.message.text.split(" ").slice(1);
    const { dateStr } = parseDate(args);
    await sendReminder(bot, db, dateStr);
    await ctx.reply(`✅ [DEV] Reminder sent for ${dateStr}.`);
  });

  bot.command("dev_cycle", async (ctx) => {
    if (!ctx.group) return;
    const args = ctx.message.text.split(" ").slice(1);
    const { date, dateStr } = parseDate(args);
    generateDutiesForDate(db, ctx.group.id, date);
    await sendDailySummary(bot, db, dateStr);
    await ctx.reply(
      `✅ [DEV] Full day cycle for ${dateStr}: generated duties + sent summary.`,
    );
  });

  bot.command("dev_list", async (ctx) => {
    if (!ctx.group || !ctx.chat) return;
    const args = ctx.message.text.split(" ").slice(1);
    const { dateStr } = parseDate(args);
    const duties = getDutiesForDate(db, ctx.group.id, dateStr);
    if (duties.length === 0) {
      await ctx.reply(`[DEV] No duties for ${dateStr}.`);
      return;
    }
    const members = Object.fromEntries(
      getAllMembers(db, ctx.group.id).map((m) => [m.id, m.name]),
    );
    const rules = Object.fromEntries(
      getActiveRules(db, ctx.group.id).map((r) => [r.id, r.name]),
    );
    const lines = duties.map(
      (d) =>
        `#${d.id} ${STATUS_ICON[d.status] ?? "?"} ${rules[d.rule_id] ?? "?"} → ${members[d.member_id] ?? "?"} [${d.status}]`,
    );
    await ctx.reply(`[DEV] Duties for ${dateStr}:\n\n${lines.join("\n")}`);
  });

  bot.command("dev_done", async (ctx) => {
    if (!ctx.group || !ctx.chat) return;
    const id = parseInt(ctx.message.text.split(" ")[1] ?? "", 10);
    const duty = getDutyById(db, id);
    if (!duty || duty.group_id !== ctx.group.id) {
      await ctx.reply("[DEV] Duty not found.");
      return;
    }
    markDone(db, duty.id, duty.member_id);
    await updatePinnedSummary(
      bot,
      db,
      ctx.group.id,
      ctx.group.chat_id,
      duty.duty_date,
    );
    await ctx.reply(`✅ [DEV] Duty #${id} marked as done.`);
  });

  bot.command("dev_request", async (ctx) => {
    if (!ctx.group || !ctx.chat) return;
    const id = parseInt(ctx.message.text.split(" ")[1] ?? "", 10);
    const duty = getDutyById(db, id);
    if (!duty || duty.group_id !== ctx.group.id) {
      await ctx.reply("[DEV] Duty not found.");
      return;
    }
    const kids = getAllMembers(db, ctx.group.id).filter(
      (m) => m.role === Role.Kid && m.id !== duty.member_id,
    );
    const requester = kids[0];
    if (!requester) {
      await ctx.reply("[DEV] No other kid to simulate the request.");
      return;
    }
    requestApproval(db, duty.id, requester.id);
    await ctx.reply(
      `⏳ [DEV] Duty #${id} set to approval_pending (requested by ${requester.name}). Use /dev_approve or /dev_reject.`,
    );
  });

  bot.command("dev_approve", async (ctx) => {
    if (!ctx.group || !ctx.chat) return;
    const id = parseInt(ctx.message.text.split(" ")[1] ?? "", 10);
    const duty = getDutyById(db, id);
    if (!duty || duty.group_id !== ctx.group.id) {
      await ctx.reply("[DEV] Duty not found.");
      return;
    }
    const parent = getParents(db, ctx.group.id)[0];
    if (!parent) {
      await ctx.reply("[DEV] No parent found to approve.");
      return;
    }
    approveOrReject(db, duty.id, parent.id, true);
    await updatePinnedSummary(
      bot,
      db,
      ctx.group.id,
      ctx.group.chat_id,
      duty.duty_date,
    );
    await ctx.reply(`✅ [DEV] Duty #${id} approved by ${parent.name}.`);
  });

  bot.command("dev_reject", async (ctx) => {
    if (!ctx.group || !ctx.chat) return;
    const id = parseInt(ctx.message.text.split(" ")[1] ?? "", 10);
    const duty = getDutyById(db, id);
    if (!duty || duty.group_id !== ctx.group.id) {
      await ctx.reply("[DEV] Duty not found.");
      return;
    }
    const parent = getParents(db, ctx.group.id)[0];
    if (!parent) {
      await ctx.reply("[DEV] No parent found to reject.");
      return;
    }
    approveOrReject(db, duty.id, parent.id, false);
    await ctx.reply(
      `❌ [DEV] Duty #${id} rejected by ${parent.name} — back to pending.`,
    );
  });

  bot.command("chatid", async (ctx) => {
    if (!ctx.chat) return;
    await ctx.reply(`Chat ID: \`${ctx.chat.id}\``, {
      parse_mode: "MarkdownV2",
    });
  });
}
