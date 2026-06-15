import type { Telegraf } from "telegraf";
import Database from "better-sqlite3";
import type { BotContext } from "../context";
import {
  upsertGroup,
  addMember,
  linkMember,
  getActiveKids,
  resetGroup,
} from "@src/db/groups";
import { getActiveRules } from "@src/db/rules";
import { Role, Gender } from "@src/types";
import { Markup } from "telegraf";
import {
  setupWelcomeKeyboard,
  addMemberRoleKeyboard,
  adminMenuKeyboard,
} from "../keyboards/registration";
import {
  setPendingMemberName,
  getPendingMemberName,
  clearPendingMemberName,
} from "../state/pendingMember";
import { MODE_LABEL } from "../keyboards/admin";

async function isGroupAdmin(ctx: BotContext): Promise<boolean> {
  if (!ctx.chat || !ctx.from) return false;
  try {
    const member = await ctx.getChatMember(ctx.from.id);
    return ["administrator", "creator"].includes(member.status);
  } catch {
    return false;
  }
}

export function registerRegistrationHandlers(
  bot: Telegraf<BotContext>,
  db: Database.Database,
): void {
  bot.command("start", async (ctx) => {
    if (!ctx.chat) return;

    if (ctx.chat.type === "private") {
      if (ctx.group && ctx.member?.role === Role.Dad) {
        const hasKids = getActiveKids(db, ctx.group.id).length > 0;
        await ctx.reply("⚙️ Меню керування:", adminMenuKeyboard(hasKids));
      }
      return;
    }

    const existing = ctx.group;
    if (existing) {
      if (ctx.member?.role !== Role.Dad) return;
      const hasKids = getActiveKids(db, existing.id).length > 0;
      await ctx.reply(
        "Сім'ю вже налаштовано. Використовуйте /menu для керування.",
        adminMenuKeyboard(hasKids),
      );
      return;
    }

    if (!(await isGroupAdmin(ctx))) return;

    await ctx.reply(
      "👋 Вітаю! Я ChoreCop — бот для розподілу домашніх обов'язків.\n\nНатисніть кнопку, щоб налаштувати сім'ю:",
      setupWelcomeKeyboard(),
    );
  });

  bot.action("setup:start", async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.chat) return;
    if (!(await isGroupAdmin(ctx))) return;

    const groupName =
      ctx.chat.type !== "private" && "title" in ctx.chat
        ? ctx.chat.title
        : "Сім'я";

    const group = upsertGroup(db, ctx.chat.id, groupName);
    ctx.group = group;

    const firstName = ctx.from?.first_name ?? "Тато";
    const dad = addMember(db, group.id, firstName, Role.Dad);
    if (ctx.from) linkMember(db, dad.id, ctx.from.id);

    await ctx.editMessageText(
      `✅ Сім\'ю <b>${groupName}</b> створено! Ти доданий як Тато.\n\nВикористовуй меню щоб додати інших членів сім\'ї.`,
      { parse_mode: "HTML", ...adminMenuKeyboard(false) },
    );
  });

  bot.command("add_member", async (ctx) => {
    if (!ctx.group || ctx.member?.role !== Role.Dad) return;
    const args = ctx.message.text.split(" ").slice(1);
    if (args.length === 0) {
      await ctx.reply(
        "Використання: /add_member @нікнейм або /add_member Ім'я\nНаприклад: /add_member @anya або /add_member Аня",
      );
      return;
    }
    const name = args.join(" ");
    setPendingMemberName(ctx.chat.id, name);
    await ctx.reply(`👤 <b>${name}</b> — оберіть роль:`, {
      parse_mode: "HTML",
      ...addMemberRoleKeyboard(),
    });
  });

  bot.action(/^setup:role:(mom|kid):(male|female)$/, async (ctx) => {
    if (!ctx.chat || !ctx.group || ctx.member?.role !== Role.Dad) {
      await ctx.answerCbQuery();
      return;
    }

    const name = getPendingMemberName(ctx.chat.id);
    if (!name) {
      await ctx.answerCbQuery("Спочатку надішліть /add_member.");
      return;
    }
    await ctx.answerCbQuery();
    const [, role, gender] = ctx.match;

    const kidCount =
      role === Role.Kid ? getActiveKids(db, ctx.group.id).length : undefined;
    const username = name.startsWith("@") ? name.slice(1) : undefined;
    addMember(
      db,
      ctx.group.id,
      name,
      role as Role,
      kidCount !== undefined ? kidCount + 1 : undefined,
      username,
      gender as Gender,
    );
    clearPendingMemberName(ctx.chat.id);

    const roleLabel =
      role === Role.Mom
        ? "Мама 👩"
        : gender === Gender.Female
          ? "Дівчинка 👧"
          : "Хлопець 👦";
    const added = gender === Gender.Female ? "додана" : "доданий";
    await ctx.editMessageText(`✅ <b>${name}</b> ${added} як ${roleLabel}.`, {
      parse_mode: "HTML",
    });
  });

  bot.command("menu", async (ctx) => {
    if (!ctx.group) {
      await ctx.reply("Спочатку налаштуйте сім'ю командою /start.");
      return;
    }
    if (ctx.member?.role !== Role.Dad) return;
    const hasKids = getActiveKids(db, ctx.group.id).length > 0;
    await ctx.reply("⚙️ Меню керування:", adminMenuKeyboard(hasKids));
  });

  bot.command("reset", async (ctx) => {
    if (!ctx.chat || ctx.chat.type !== "private") return;
    if (
      !ctx.group ||
      (ctx.member?.role !== Role.Dad && ctx.member?.role !== Role.Mom)
    )
      return;
    await ctx.reply(
      "⚠️ <b>Увага!</b> Це видалить усі дані сім'ї: учасників, завдання, правила та історію чергувань. Дію неможливо скасувати.",
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🗑 Так, скинути все", "reset:confirm")],
          [Markup.button.callback("❌ Скасувати", "reset:cancel")],
        ]),
      },
    );
  });

  bot.action("reset:confirm", async (ctx) => {
    await ctx.answerCbQuery();
    if (
      !ctx.group ||
      (ctx.member?.role !== Role.Dad && ctx.member?.role !== Role.Mom)
    )
      return;
    resetGroup(db, ctx.group.id);
    ctx.group = null;
    await ctx.editMessageText(
      "✅ Дані сім'ї видалено. Перейдіть у групу сім'ї та надішліть /start, щоб налаштувати все знову.",
    );
  });

  bot.action("reset:cancel", async (ctx) => {
    await ctx.answerCbQuery("Скасовано.");
    await ctx.deleteMessage();
  });

  bot.command("list_rules", async (ctx) => {
    if (!ctx.group) {
      await ctx.reply("Спочатку налаштуйте сім'ю командою /start.");
      return;
    }
    if (ctx.member?.role !== Role.Dad && ctx.member?.role !== Role.Mom) return;

    const rules = getActiveRules(db, ctx.group.id);
    if (rules.length === 0) {
      await ctx.reply("📋 Завдань ще немає. Додайте через ⚙️ Меню.");
      return;
    }

    const lines = rules.map((r) => {
      const days = r.schedule.split(",").join(", ");
      const mode = MODE_LABEL[r.rotation_mode] ?? r.rotation_mode;
      return `📌 <b>${r.name}</b>\n   Дні: ${days} · ${mode} · ${r.workers_count} чол.`;
    });

    await ctx.reply(
      `📋 <b>Активні завдання (${rules.length}):</b>\n\n${lines.join("\n\n")}`,
      {
        parse_mode: "HTML",
      },
    );
  });
}
