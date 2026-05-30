import type { MiddlewareFn } from 'telegraf';
import Database from 'better-sqlite3';
import type { BotContext } from '../context.js';
import { findFamilyByChatId, findMemberByTelegramId } from '../../db/families.js';

export function familyMiddleware(db: Database.Database): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    ctx.family = null;
    ctx.member = null;

    const chatId = ctx.chat?.id;
    const fromId = ctx.from?.id;

    if (chatId) {
      ctx.family = findFamilyByChatId(db, chatId);
    }

    if (ctx.family && fromId) {
      ctx.member = findMemberByTelegramId(db, ctx.family.id, fromId);
    }

    return next();
  };
}
