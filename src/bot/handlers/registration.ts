import type { Telegraf } from 'telegraf';
import Database from 'better-sqlite3';
import type { BotContext } from '../context.js';
import {
  upsertFamily, addMember, linkMember,
  getUnlinkedMembers, getActiveKids,
} from '../../db/families.js';
import {
  setupWelcomeKeyboard,
  linkAccountKeyboard,
  adminMenuKeyboard,
} from '../keyboards/registration.js';

export function registerRegistrationHandlers(bot: Telegraf<BotContext>, db: Database.Database): void {
  bot.command('start', async (ctx) => {
    if (!ctx.chat || ctx.chat.type === 'private') return;

    const existing = ctx.family;
    if (existing) {
      await ctx.reply('Сім\'ю вже налаштовано. Використовуйте /menu для керування.', adminMenuKeyboard());
      return;
    }

    await ctx.reply(
      '👋 Вітаю! Я ChoreCop — бот для розподілу домашніх обов\'язків.\n\nНатисніть кнопку, щоб налаштувати сім\'ю:',
      setupWelcomeKeyboard(),
    );
  });

  bot.action('setup:start', async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.chat) return;

    const groupName = ctx.chat.type !== 'private' && 'title' in ctx.chat
      ? ctx.chat.title
      : 'Сім\'я';

    const family = upsertFamily(db, ctx.chat.id, groupName);
    ctx.family = family;

    const firstName = ctx.from?.first_name ?? 'Тато';
    const dad = addMember(db, family.id, firstName, 'dad');
    if (ctx.from) linkMember(db, dad.id, ctx.from.id);

    await ctx.editMessageText(
      `✅ Сім\'ю <b>${groupName}</b> створено! Ти доданий як Тато.\n\n` +
      `Тепер додай інших членів сім\'ї командою /add_member.`,
      { parse_mode: 'HTML', ...adminMenuKeyboard() },
    );
  });

  bot.command('add_member', async (ctx) => {
    if (!ctx.family || ctx.member?.role !== 'dad') return;
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length === 0) {
      await ctx.reply('Використання: /add_member Ім\'я\nНаприклад: /add_member Аня');
      return;
    }
    const name = args.join(' ');
    const kidCount = getActiveKids(db, ctx.family.id).length;
    addMember(db, ctx.family.id, name, 'kid', kidCount + 1);

    const unlinked = getUnlinkedMembers(db, ctx.family.id);
    await ctx.reply(
      `✅ Додано члена сім\'ї: <b>${name}</b>\n\nЩоб прив\'язати акаунт Telegram, нехай ${name} натисне свою кнопку:`,
      { parse_mode: 'HTML', ...linkAccountKeyboard(unlinked) },
    );
  });

  bot.action(/^link:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.from || !ctx.family) return;

    const memberId = parseInt(ctx.match[1], 10);
    linkMember(db, memberId, ctx.from.id);

    const name = ctx.from.first_name;
    await ctx.reply(`✅ Акаунт <b>${name}</b> прив\'язано!`, { parse_mode: 'HTML' });
  });

  bot.command('menu', async (ctx) => {
    if (!ctx.family) {
      await ctx.reply('Спочатку налаштуйте сім\'ю командою /start.');
      return;
    }
    if (ctx.member?.role !== 'dad' && ctx.member?.role !== 'mom') return;
    await ctx.reply('⚙️ Меню керування:', adminMenuKeyboard());
  });
}
