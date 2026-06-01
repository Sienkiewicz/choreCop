import type { Telegraf } from 'telegraf';
import { Markup } from 'telegraf';
import Database from 'better-sqlite3';
import type { BotContext } from '../context.js';
import { upsertFamily, addMember, linkMember, getActiveKids, getAllMembers, resetFamily } from '../../db/families.js';
import { getActiveRules } from '../../db/rules.js';
import { setupWelcomeKeyboard, miniAppKeyboard } from '../keyboards/registration.js';

async function isGroupAdmin(ctx: BotContext): Promise<boolean> {
  if (!ctx.chat || !ctx.from) return false;
  try {
    const m = await ctx.getChatMember(ctx.from.id);
    return m.status === 'administrator' || m.status === 'creator';
  } catch {
    return false;
  }
}

export function registerRegistrationHandlers(bot: Telegraf<BotContext>, db: Database.Database): void {
  const miniAppUrl = process.env.MINI_APP_URL ?? '';

  bot.command('start', async (ctx) => {
    if (!ctx.chat || ctx.chat.type === 'private') return;
    if (ctx.family) {
      if (ctx.member?.role !== 'dad') return;
      await ctx.reply('⚙️ Відкрийте налаштування:', miniAppKeyboard(miniAppUrl));
      return;
    }
    if (!(await isGroupAdmin(ctx))) return;
    await ctx.reply(
      '👋 Вітаю! Я ChoreCop — бот для розподілу домашніх обов\'язків.\n\nВідкрийте налаштування щоб створити сім\'ю:',
      miniAppKeyboard(miniAppUrl),
    );
  });

  bot.command('menu', async (ctx) => {
    if (!ctx.family || ctx.member?.role !== 'dad') return;
    await ctx.reply('⚙️ Налаштування:', miniAppKeyboard(miniAppUrl));
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
    if (!ctx.family) { await ctx.reply('Спочатку налаштуйте сім\'ю командою /start.'); return; }
    if (ctx.member?.role !== 'dad' && ctx.member?.role !== 'mom') return;

    const rules = getActiveRules(db, ctx.family.id);
    if (!rules.length) { await ctx.reply('📋 Завдань ще немає.'); return; }

    const members = Object.fromEntries(getAllMembers(db, ctx.family.id).map(m => [m.id, m.name]));
    const modeLabel: Record<string, string> = {
      round_robin: '🔄 По черзі', fixed: '📌 Фіксовані', all: '👥 Всі діти',
    };
    const lines = rules.map(r =>
      `📌 <b>${r.name}</b>\n   Дні: ${r.schedule.split(',').join(', ')} · ${modeLabel[r.rotation_mode]} · ${r.workers_count} чол.`
    );
    await ctx.reply(`📋 <b>Активні завдання (${rules.length}):</b>\n\n${lines.join('\n\n')}`, { parse_mode: 'HTML' });
  });
}
