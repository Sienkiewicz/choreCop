import type { MiddlewareFn } from "telegraf";
import Database from "better-sqlite3";
import type { BotContext } from "../context";
import {
  findGroupByChatId,
  findMemberByTelegramId,
  findMemberByUsername,
  linkMember,
  findMemberWithGroupByTelegramId,
} from "@src/db/groups";

const ANONYMOUS_ADMIN_ID = 1087968824;

export function groupMiddleware(
  db: Database.Database,
): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    ctx.group = null;
    ctx.member = null;

    if (!ctx.from || ctx.from.id === ANONYMOUS_ADMIN_ID) return;

    const chatId = ctx.chat?.id;
    const fromId = ctx.from.id;

    if (chatId && ctx.chat?.type !== "private") {
      ctx.group = findGroupByChatId(db, chatId);
    }

    if (ctx.group && fromId) {
      ctx.member = findMemberByTelegramId(db, ctx.group.id, fromId);

      if (!ctx.member && ctx.from.username) {
        const byUsername = findMemberByUsername(
          db,
          ctx.group.id,
          ctx.from.username,
        );
        if (byUsername && !byUsername.telegram_id) {
          linkMember(db, byUsername.id, fromId);
          ctx.member = { ...byUsername, telegram_id: fromId };
        }
      }
    }

    if (!ctx.group && ctx.chat?.type === "private" && fromId) {
      const result = findMemberWithGroupByTelegramId(db, fromId);
      if (result) {
        ctx.group = result.group;
        ctx.member = result.member;
      }
    }

    return next();
  };
}
