import type { Telegraf } from 'telegraf';
import { Markup } from 'telegraf';
import Database from 'better-sqlite3';
import type { BotContext } from '../context.js';
import { createRule, setFixedAssignments, getActiveRules } from '../../db/rules.js';
import { getActiveKids, getAllMembers } from '../../db/families.js';
import {
  initWizard, getWizard, updateWizard, clearWizard,
} from '../state/wizard.js';
import {
  dayPickerKeyboard, workerCountKeyboard,
  splitDaysKeyboard, rotationModeKeyboard, fixedMembersKeyboard,
} from '../keyboards/admin.js';

export function registerAdminHandlers(bot: Telegraf<BotContext>, db: Database.Database): void {
  bot.action('admin:menu', async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.family) return;
    const hasKids = getActiveKids(db, ctx.family.id).length > 0;
    const buttons = [];
    if (hasKids) buttons.push([Markup.button.callback('➕ Додати завдання', 'admin:add_rule')]);
    buttons.push([Markup.button.callback('👥 Члени сім\'ї', 'admin:members')]);
    await ctx.editMessageText('⚙️ Меню керування:', Markup.inlineKeyboard(buttons));
  });

  bot.action('admin:members', async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.family) return;

    const members = getAllMembers(db, ctx.family.id);
    const roleLabel: Record<string, string> = { dad: '👨 Тато', mom: '👩 Мама', kid: '🧒 Дитина' };
    const lines = members.map(m => {
      const linked = m.telegram_id ? '🔗' : '⬜';
      return `${linked} ${roleLabel[m.role] ?? m.role} — ${m.name}`;
    });

    const text = lines.length > 0
      ? `👥 <b>Члени сім\'ї:</b>\n\n${lines.join('\n')}\n\n🔗 = прив\'язаний акаунт Telegram`
      : '👥 Поки немає членів сім\'ї.';

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'admin:menu')]]),
    });
  });

  bot.action('admin:add_rule', async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.chat || !ctx.family) return;
    if (ctx.member?.role !== 'dad' && ctx.member?.role !== 'mom') {
      await ctx.answerCbQuery('Тільки батьки можуть керувати завданнями.');
      return;
    }

    const existingCount = getActiveRules(db, ctx.family.id).length;
    initWizard(ctx.chat.id, `Завдання ${existingCount + 1}`);
    await ctx.editMessageText(
      '📅 <b>Крок 1: Оберіть дні тижня</b>\n\nНатискайте на дні, потім → Далі',
      { parse_mode: 'HTML', ...dayPickerKeyboard([]) },
    );
  });

  bot.action(/^rule:day:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.chat) return;
    const state = getWizard(ctx.chat.id);
    if (!state) return;

    const day = ctx.match[1];
    const days = state.selectedDays.includes(day)
      ? state.selectedDays.filter(d => d !== day)
      : [...state.selectedDays, day];
    updateWizard(ctx.chat.id, { selectedDays: days });

    await ctx.editMessageReplyMarkup(dayPickerKeyboard(days).reply_markup);
  });

  bot.action('rule:days:confirm', async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.chat || !ctx.family) return;
    const state = getWizard(ctx.chat.id);
    if (!state || state.selectedDays.length === 0) {
      await ctx.answerCbQuery('Оберіть хоча б один день!');
      return;
    }
    const kidCount = getActiveKids(db, ctx.family.id).length;
    updateWizard(ctx.chat.id, { step: 'workers' });
    await ctx.editMessageText(
      '👥 <b>Крок 2: Скільки дітей чергує за раз?</b>',
      { parse_mode: 'HTML', ...workerCountKeyboard(kidCount) },
    );
  });

  bot.action(/^rule:workers:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.chat) return;
    const state = getWizard(ctx.chat.id);
    if (!state) return;

    updateWizard(ctx.chat.id, { workersCount: parseInt(ctx.match[1], 10), step: 'split' });
    await ctx.editMessageText(
      '📆 <b>Крок 3: Однакові умови для всіх вибраних днів?</b>',
      { parse_mode: 'HTML', ...splitDaysKeyboard() },
    );
  });

  bot.action('rule:split:all', async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.chat) return;
    updateWizard(ctx.chat.id, { step: 'rotation', remainingDays: [] });
    await ctx.editMessageText(
      '🔄 <b>Крок 4: Тип ротації</b>',
      { parse_mode: 'HTML', ...rotationModeKeyboard() },
    );
  });

  bot.action('rule:split:subset', async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.chat) return;
    updateWizard(ctx.chat.id, { step: 'rotation', remainingDays: [] });
    await ctx.editMessageText(
      '🔄 <b>Крок 4: Тип ротації</b>',
      { parse_mode: 'HTML', ...rotationModeKeyboard() },
    );
  });

  bot.action(/^rule:rotation:(round_robin|fixed|all)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.chat || !ctx.family) return;
    const mode = ctx.match[1] as 'round_robin' | 'fixed' | 'all';
    updateWizard(ctx.chat.id, { rotationMode: mode });

    if (mode === 'fixed') {
      const kids = getActiveKids(db, ctx.family.id);
      updateWizard(ctx.chat.id, { step: 'fixed_members' });
      await ctx.editMessageText(
        '👤 <b>Крок 5: Оберіть фіксованих чергових</b>',
        { parse_mode: 'HTML', ...fixedMembersKeyboard(kids, []) },
      );
    } else {
      await saveRule(ctx, db);
    }
  });

  bot.action(/^rule:member:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.chat || !ctx.family) return;
    const state = getWizard(ctx.chat.id);
    if (!state) return;

    const memberId = parseInt(ctx.match[1], 10);
    const ids = state.fixedMembers.includes(memberId)
      ? state.fixedMembers.filter(id => id !== memberId)
      : [...state.fixedMembers, memberId];
    updateWizard(ctx.chat.id, { fixedMembers: ids });

    const kids = getActiveKids(db, ctx.family.id);
    await ctx.editMessageReplyMarkup(fixedMembersKeyboard(kids, ids).reply_markup);
  });

  bot.action('rule:save', async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.chat) return;
    await saveRule(ctx, db);
  });
}

async function saveRule(ctx: BotContext, db: Database.Database) {
  if (!ctx.chat || !ctx.family) return;
  const state = getWizard(ctx.chat.id);
  if (!state || !state.rotationMode) return;

  const schedule = state.selectedDays.join(',');
  const rule = createRule(
    db,
    ctx.family.id,
    state.ruleName,
    schedule,
    state.workersCount,
    state.rotationMode,
  );

  if (state.rotationMode === 'fixed') {
    setFixedAssignments(db, rule.id, state.fixedMembers);
  }

  clearWizard(ctx.chat.id);

  await (ctx as any).editMessageText(
    `✅ <b>Завдання збережено!</b>\n📌 Розклад: ${schedule}\n👥 Чергових: ${state.workersCount}\n🔄 Тип: ${state.rotationMode}`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[Markup.button.callback('⚙️ Меню', 'admin:menu')]]),
    },
  );
}
