import type { Telegraf } from "telegraf";
import Database from "better-sqlite3";
import type { BotContext } from "../context.js";
import {
  getDutyById,
  markDone,
  requestApproval,
  approveOrReject,
  getPendingDuties,
} from "../../db/duties.js";
import {
  findGroupById,
  findMemberByTelegramId,
  getAllMembers,
  getParents,
} from "../../db/groups.js";
import { getActiveRules } from "../../db/rules.js";
import { Role, DutyStatus } from "../../types.js";
import {
  buildApprovalMessage,
  buildTaskListMessage,
} from "../keyboards/duties.js";
import { updatePinnedSummary } from "../../scheduler/reminders.js";
import { trackAndPrune } from "../helpers/messages.js";

const parents: Role[] = [Role.Dad, Role.Mom];

async function handleMarkDone(
  bot: Telegraf<BotContext>,
  db: Database.Database,
  ctx: BotContext,
  dutyId: number,
): Promise<void> {
  if (!ctx.from) {
    await ctx.answerCbQuery();
    return;
  }

  const duty = getDutyById(db, dutyId);
  if (!duty || duty.status === DutyStatus.Done) {
    await ctx.answerCbQuery("Це завдання вже виконано.");
    return;
  }

  const group = findGroupById(db, duty.group_id);
  if (!group) {
    await ctx.answerCbQuery();
    return;
  }

  const presser = findMemberByTelegramId(db, group.id, ctx.from.id);
  const isDutyPerson = presser?.id === duty.member_id;
  const isParent = presser ? parents.includes(presser.role) : false;

  if (isDutyPerson || isParent) {
    markDone(db, duty.id, presser!.id);
    await ctx.answerCbQuery("✅ Виконано!");
    await updatePinnedSummary(bot, db, group.id, group.chat_id, duty.duty_date);
  } else {
    if (!presser) {
      await ctx.answerCbQuery("Ваш акаунт не прив'язано до групи.");
      return;
    }
    if (duty.status === DutyStatus.ApprovalPending) {
      await ctx.answerCbQuery();
      return;
    }

    requestApproval(db, duty.id, presser.id);
    await ctx.answerCbQuery("Запит на схвалення відправлено тату.");

    const membersMap = Object.fromEntries(
      getAllMembers(db, group.id).map((m) => [m.id, m]),
    );
    const rules = Object.fromEntries(
      getActiveRules(db, group.id).map((r) => [r.id, r.name]),
    );
    const dutyOwner = membersMap[duty.member_id];
    const { text, reply_markup } = buildApprovalMessage(
      presser,
      dutyOwner,
      rules[duty.rule_id] ?? "???",
      duty.id,
    );

    const dads = getParents(db, group.id).filter(
      (p) => p.role === Role.Dad && p.telegram_id,
    );
    if (dads.length > 0) {
      for (const dad of dads) {
        try {
          await bot.telegram.sendMessage(dad.telegram_id!, text, {
            reply_markup,
            parse_mode: "HTML",
          });
        } catch {
          /* dad hasn't started DM with bot */
        }
      }
    } else {
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
    }
  }
}

export function registerDutyHandlers(
  bot: Telegraf<BotContext>,
  db: Database.Database,
): void {
  bot.action(/^menu:done:(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    if (!ctx.group || !ctx.chat || !ctx.from) {
      await ctx.answerCbQuery();
      return;
    }

    const date = ctx.match[1];
    const pending = getPendingDuties(db, ctx.group.id, date);

    if (pending.length === 0) {
      await ctx.answerCbQuery("✅ Всі завдання вже виконані!", {
        show_alert: true,
      });
      return;
    }

    if (pending.length === 1) {
      await handleMarkDone(bot, db, ctx, pending[0].id);
      return;
    }

    const membersMap = Object.fromEntries(
      getAllMembers(db, ctx.group.id).map((m) => [m.id, m]),
    );
    const rulesMap = Object.fromEntries(
      getActiveRules(db, ctx.group.id).map((r) => [r.id, r.name]),
    );
    const { text, reply_markup } = buildTaskListMessage(
      pending,
      membersMap,
      rulesMap,
    );

    try {
      await ctx.telegram.sendMessage(ctx.from.id, text, {
        reply_markup,
        parse_mode: "HTML",
      });
      await ctx.answerCbQuery("📋 Перевірте особисті повідомлення", {
        show_alert: true,
      });
    } catch {
      await ctx.answerCbQuery();
      const msg = await ctx.reply(text, { reply_markup, parse_mode: "HTML" });
      await trackAndPrune(
        ctx.telegram,
        db,
        ctx.group.id,
        ctx.chat.id,
        msg.message_id,
      );
    }
  });

  bot.action(/^done:(\d+)$/, async (ctx) => {
    const dutyId = parseInt(ctx.match[1], 10);
    await handleMarkDone(bot, db, ctx, dutyId);
  });

  bot.action(/^approve:(\d+)$/, async (ctx) => {
    if (!ctx.from) {
      await ctx.answerCbQuery();
      return;
    }

    const dutyId = parseInt(ctx.match[1], 10);
    const duty = getDutyById(db, dutyId);
    if (!duty) {
      await ctx.answerCbQuery();
      return;
    }

    const group = findGroupById(db, duty.group_id);
    if (!group) {
      await ctx.answerCbQuery();
      return;
    }

    const approver = findMemberByTelegramId(db, group.id, ctx.from.id);
    if (!approver || !parents.includes(approver.role)) {
      await ctx.answerCbQuery("Тільки батьки можуть схвалювати.");
      return;
    }

    approveOrReject(db, duty.id, approver.id, true);
    await ctx.answerCbQuery("✅ Схвалено!");
    await ctx.editMessageText("✅ Схвалено!");
    await updatePinnedSummary(bot, db, group.id, group.chat_id, duty.duty_date);
  });

  bot.action(/^reject:(\d+)$/, async (ctx) => {
    if (!ctx.from) {
      await ctx.answerCbQuery();
      return;
    }

    const dutyId = parseInt(ctx.match[1], 10);
    const duty = getDutyById(db, dutyId);
    if (!duty) {
      await ctx.answerCbQuery();
      return;
    }

    const group = findGroupById(db, duty.group_id);
    if (!group) {
      await ctx.answerCbQuery();
      return;
    }

    const approver = findMemberByTelegramId(db, group.id, ctx.from.id);
    if (!approver || !parents.includes(approver.role)) {
      await ctx.answerCbQuery("Тільки батьки можуть відхиляти.");
      return;
    }

    approveOrReject(db, duty.id, approver.id, false);
    await ctx.answerCbQuery();
    await ctx.editMessageText("❌ Відхилено. Завдання повернено до черги.");
    await updatePinnedSummary(bot, db, group.id, group.chat_id, duty.duty_date);
  });
}
