import type { MiddlewareFn } from 'telegraf';
import Database from 'better-sqlite3';
import type { BotContext } from '../context.js';
import { findFamilyByChatId, findMemberByTelegramId } from '../../db/families.js';

const ANONYMOUS_ADMIN_ID = 1087968824;

export function familyMiddleware(db: Database.Database): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    ctx.family = null;
    ctx.member = null;

    if (!ctx.from || ctx.from.id === ANONYMOUS_ADMIN_ID) return;

    const chatId = ctx.chat?.id;
    const fromId = ctx.from.id;

    if (chatId) {
      ctx.family = findFamilyByChatId(db, chatId);
    }

    if (ctx.family && fromId) {
      ctx.member = findMemberByTelegramId(db, ctx.family.id, fromId);
    }

    return next();
  };
}
