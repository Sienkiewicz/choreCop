import type { Telegraf } from 'telegraf';
import Database from 'better-sqlite3';
import type { BotContext } from '../context.js';
import {
  upsertFamily, addMember, linkMember,
  getActiveKids, getAllMembers,
  resetFamily,
} from '../../db/families.js';
import { getActiveRules } from '../../db/rules.js';
import { Markup } from 'telegraf';
import {
  setupWelcomeKeyboard,
  addMemberRoleKeyboard,
  adminMenuKeyboard,
} from '../keyboards/registration.js';

async function isGroupAdmin(ctx: BotContext): Promise<boolean> {
  if (!ctx.chat || !ctx.from) return false;
  try {
    const member = await ctx.getChatMember(ctx.from.id);
    return member.status === 'administrator' || member.status === 'creator';
  } catch {
    return false;
  }
}

export function registerRegistrationHandlers(bot: Telegraf<BotContext>, db: Database.Database): void {
  bot.command('start', async (ctx) => {
    if (!ctx.chat || ctx.chat.type === 'private') return;

    const existing = ctx.family;
    if (existing) {
      if (ctx.member?.role !== 'dad') return;
      const hasKids = getActiveKids(db, existing.id).length > 0;
      await ctx.reply('Сім\'ю вже налаштовано. Використовуйте /menu для керування.', adminMenuKeyboard(hasKids));
      return;
    }

    if (!(await isGroupAdmin(ctx))) return;

    await ctx.reply(
      '👋 Вітаю! Я ChoreCop — бот для розподілу домашніх обов\'язків.\n\nНатисніть кнопку, щоб налаштувати сім\'ю:',
      setupWelcomeKeyboard(),
    );
  });

  bot.action('setup:start', async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.chat) return;
    if (!(await isGroupAdmin(ctx))) return;

    const groupName = ctx.chat.type !== 'private' && 'title' in ctx.chat
      ? ctx.chat.title
      : 'Сім\'я';

    const family = upsertFamily(db, ctx.chat.id, groupName);
    ctx.family = family;

    const firstName = ctx.from?.first_name ?? 'Тато';
    const dad = addMember(db, family.id, firstName, 'dad');
    if (ctx.from) linkMember(db, dad.id, ctx.from.id);

    await ctx.editMessageText(
      `✅ Сім\'ю <b>${groupName}</b> створено! Ти доданий як Тато.\n\nВикористовуй меню щоб додати інших членів сім\'ї.`,
      { parse_mode: 'HTML', ...adminMenuKeyboard(false) },
    );
  });

  bot.command('add_member', async (ctx) => {
    if (!ctx.family || ctx.member?.role !== 'dad') return;
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length === 0) {
      await ctx.reply('Використання: /add_member @нікнейм або /add_member Ім\'я\nНаприклад: /add_member @anya або /add_member Аня');
      return;
    }
    const name = args.join(' ');
    await ctx.reply(
      `👤 <b>${name}</b> — оберіть роль:`,
      { parse_mode: 'HTML', ...addMemberRoleKeyboard(name) },
    );
  });

  bot.action(/^setup:role:(.+):(mom|kid)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.family || ctx.member?.role !== 'dad') return;

    const name = decodeURIComponent(ctx.match[1]);
    const role = ctx.match[2] as 'mom' | 'kid';
    const kidCount = role === 'kid' ? getActiveKids(db, ctx.family.id).length : undefined;
    addMember(db, ctx.family.id, name, role, kidCount !== undefined ? kidCount + 1 : undefined);

    const roleLabel = role === 'mom' ? 'Мама 👩' : 'Дитина 🧒';
    await ctx.editMessageText(
      `✅ <b>${name}</b> доданий як ${roleLabel}.`,
      { parse_mode: 'HTML' },
    );
  });

  bot.command('menu', async (ctx) => {
    if (!ctx.family) {
      await ctx.reply('Спочатку налаштуйте сім\'ю командою /start.');
      return;
    }
    if (ctx.member?.role !== 'dad') return;
    const hasKids = getActiveKids(db, ctx.family.id).length > 0;
    await ctx.reply('⚙️ Меню керування:', adminMenuKeyboard(hasKids));
  });

  bot.command('reset', async (ctx) => {
    if (!ctx.family || ctx.member?.role !== 'dad') return;
    await ctx.reply(
      '⚠️ <b>Увага!</b> Це видалить усі дані сім\'ї: учасників, завдання, правила та історію чергувань. Дію неможливо скасувати.',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🗑 Так, скинути все', 'reset:confirm')],
          [Markup.button.callback('❌ Скасувати', 'reset:cancel')],
        ]),
      },
    );
  });

  bot.action('reset:confirm', async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.family || ctx.member?.role !== 'dad') return;
    resetFamily(db, ctx.family.id);
    ctx.family = null;
    await ctx.editMessageText('✅ Дані сім\'ї видалено. Надішліть /start щоб почати заново.');
  });

  bot.action('reset:cancel', async (ctx) => {
    await ctx.answerCbQuery('Скасовано.');
    await ctx.deleteMessage();
  });

  bot.command('list_rules', async (ctx) => {
    if (!ctx.family) {
      await ctx.reply('Спочатку налаштуйте сім\'ю командою /start.');
      return;
    }
    if (ctx.member?.role !== 'dad' && ctx.member?.role !== 'mom') return;

    const rules = getActiveRules(db, ctx.family.id);
    if (rules.length === 0) {
      await ctx.reply('📋 Завдань ще немає. Додайте через ⚙️ Меню.');
      return;
    }

    const members = Object.fromEntries(
      getAllMembers(db, ctx.family.id).map(m => [m.id, m.name])
    );
    const modeLabel: Record<string, string> = {
      round_robin: '🔄 По черзі',
      fixed: '📌 Фіксовані',
      all: '👥 Всі діти',
    };

    const lines = rules.map(r => {
      const days = r.schedule.split(',').join(', ');
      const mode = modeLabel[r.rotation_mode] ?? r.rotation_mode;
      return `📌 <b>${r.name}</b>\n   Дні: ${days} · ${mode} · ${r.workers_count} чол.`;
    });

    await ctx.reply(`📋 <b>Активні завдання (${rules.length}):</b>\n\n${lines.join('\n\n')}`, {
      parse_mode: 'HTML',
    });
  });
}
