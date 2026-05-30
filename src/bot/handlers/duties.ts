import type { Telegraf } from 'telegraf';
import Database from 'better-sqlite3';
import type { BotContext } from '../context.js';
import {
  getDutyById, markDone, requestApproval, approveOrReject,
} from '../../db/duties.js';
import { getAllMembers } from '../../db/families.js';
import { getActiveRules } from '../../db/rules.js';
import { buildApprovalMessage } from '../keyboards/duties.js';
import { updatePinnedSummary } from '../../scheduler/reminders.js';

export function registerDutyHandlers(bot: Telegraf<BotContext>, db: Database.Database): void {
  bot.action(/^done:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.from || !ctx.family || !ctx.chat) return;

    const dutyId = parseInt(ctx.match[1], 10);
    const duty = getDutyById(db, dutyId);
    if (!duty || duty.status === 'done') {
      await ctx.answerCbQuery('Це завдання вже виконано.');
      return;
    }

    const presser = ctx.member;
    const isParent = presser?.role === 'dad' || presser?.role === 'mom';
    const isDutyPerson = presser?.id === duty.member_id;

    if (isDutyPerson || isParent) {
      markDone(db, duty.id);
      await ctx.answerCbQuery('✅ Виконано!');
    } else {
      if (!presser) {
        await ctx.answerCbQuery('Ваш акаунт не прив\'язано до сім\'ї.');
        return;
      }
      requestApproval(db, duty.id, presser.id);

      const members = Object.fromEntries(
        getAllMembers(db, ctx.family.id).map(m => [m.id, m.name])
      );
      const rules = Object.fromEntries(
        getActiveRules(db, ctx.family.id).map(r => [r.id, r.name])
      );

      const { text, reply_markup } = buildApprovalMessage(
        presser.name,
        members[duty.member_id] ?? '???',
        rules[duty.rule_id] ?? '???',
        duty.id,
      );
      await ctx.reply(text, { reply_markup, parse_mode: 'HTML' });
      await ctx.answerCbQuery('Запит на схвалення відправлено батькам.');
      return;
    }

    await updatePinnedSummary(bot, db, ctx.family.id, ctx.chat.id);
  });

  bot.action(/^approve:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.from || !ctx.family || !ctx.chat) return;
    if (ctx.member?.role !== 'dad' && ctx.member?.role !== 'mom') {
      await ctx.answerCbQuery('Тільки батьки можуть схвалювати.');
      return;
    }

    const dutyId = parseInt(ctx.match[1], 10);
    const duty = getDutyById(db, dutyId);
    if (!duty) return;

    approveOrReject(db, duty.id, ctx.member.id, true);
    await ctx.editMessageText('✅ Схвалено!');
    await updatePinnedSummary(bot, db, ctx.family.id, ctx.chat.id);
  });

  bot.action(/^reject:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.from || !ctx.family || !ctx.chat) return;
    if (ctx.member?.role !== 'dad' && ctx.member?.role !== 'mom') {
      await ctx.answerCbQuery('Тільки батьки можуть відхиляти.');
      return;
    }

    const dutyId = parseInt(ctx.match[1], 10);
    const duty = getDutyById(db, dutyId);
    if (!duty) return;

    approveOrReject(db, duty.id, ctx.member.id, false);
    await ctx.editMessageText('❌ Відхилено. Завдання повернено до черги.');
    await updatePinnedSummary(bot, db, ctx.family.id, ctx.chat.id);
  });
}
