import type { Telegraf } from "telegraf";
import { Markup } from "telegraf";
import Database from "better-sqlite3";
import type { BotContext } from "../context.js";
import {
  createRule,
  setFixedAssignments,
  getActiveRules,
  getFixedAssignments,
  deactivateRule,
} from "../../db/rules.js";
import {
  getActiveKids,
  getAllMembers,
  addMember,
  linkMember,
  clearGroup,
} from "../../db/groups.js";
import {
  initWizard,
  getWizard,
  updateWizard,
  clearWizard,
} from "../state/wizard.js";
import {
  namePickerKeyboard,
  dayPickerKeyboard,
  workerCountKeyboard,
  splitDaysKeyboard,
  subsetDayPickerKeyboard,
  rotationModeKeyboard,
  fixedMembersKeyboard,
  confirmRuleKeyboard,
  deleteRuleKeyboard,
  RULE_NAME_PRESETS,
  DAY_LABELS,
  dayNames,
  MODE_LABEL,
  ROLE_LABEL,
} from "../keyboards/admin.js";
import { adminMenuKeyboard } from "../keyboards/registration.js";
import { trackAndPrune } from "../helpers/messages.js";

export function registerAdminHandlers(
  bot: Telegraf<BotContext>,
  db: Database.Database,
): void {
  bot.action("admin:menu", async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.group) return;
    const hasKids = getActiveKids(db, ctx.group.id).length > 0;
    await ctx.editMessageText("⚙️ Меню керування:", adminMenuKeyboard(hasKids));
  });

  bot.action("admin:members", async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.group) return;

    const members = getAllMembers(db, ctx.group.id);
    const lines = members.map((m) => {
      const linked = m.telegram_id ? "🔗" : "⬜";
      return `${linked} ${ROLE_LABEL[m.role] ?? m.role} — ${m.name}`;
    });

    const text =
      lines.length > 0
        ? `👥 <b>Члени сім\'ї:</b>\n\n${lines.join("\n")}\n\n🔗 = прив\'язаний акаунт Telegram`
        : "👥 Поки немає членів сім'ї.";

    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("⬅️ Назад", "admin:menu")],
      ]),
    });
  });

  bot.action("admin:overview", async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.group) return;

    const members = getAllMembers(db, ctx.group.id);
    const memberLines = members.map((m) => {
      const linked = m.telegram_id ? "🔗" : "⬜";
      return `${linked} ${ROLE_LABEL[m.role] ?? m.role} — ${m.name}`;
    });

    const rules = getActiveRules(db, ctx.group.id);
    const membersMap = Object.fromEntries(members.map((m) => [m.id, m.name]));
    const ruleLines = rules.map((r) => {
      const days = r.schedule
        .split(",")
        .map((d) => DAY_LABELS[d] ?? d)
        .join(", ");
      const mode = MODE_LABEL[r.rotation_mode] ?? r.rotation_mode;
      let line = `📌 <b>${r.name}</b>\n   Дні: ${days} · ${mode} · ${r.workers_count} чол.`;
      if (r.rotation_mode === "fixed") {
        const names = getFixedAssignments(db, r.id).map(
          (fa) => membersMap[fa.member_id] ?? "?",
        );
        if (names.length > 0) line += `\n   Чергові: ${names.join(", ")}`;
      }
      return line;
    });

    const text =
      "📋 <b>Поточні налаштування</b>\n\n" +
      "👥 <b>Члени сім'ї:</b>\n" +
      (memberLines.length > 0 ? memberLines.join("\n") : "— немає —") +
      "\n\n📌 <b>Завдання:</b>\n" +
      (ruleLines.length > 0 ? ruleLines.join("\n\n") : "— завдань ще немає —");

    const buttons = [];
    if (rules.length > 0)
      buttons.push([
        Markup.button.callback("🗑 Видалити завдання", "admin:delete_rule"),
      ]);
    buttons.push([Markup.button.callback("⬅️ Назад", "admin:menu")]);

    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard(buttons),
    });
  });

  bot.action("admin:delete_rule", async (ctx) => {
    if (!ctx.group) {
      await ctx.answerCbQuery();
      return;
    }
    const rules = getActiveRules(db, ctx.group.id);
    if (rules.length === 0) {
      await ctx.answerCbQuery("Немає завдань для видалення.", {
        show_alert: true,
      });
      return;
    }
    await ctx.answerCbQuery();
    await ctx.editMessageText("🗑 <b>Оберіть завдання для видалення:</b>", {
      parse_mode: "HTML",
      ...deleteRuleKeyboard(rules),
    });
  });

  bot.action(/^rule:delete:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.group) return;
    const ruleId = parseInt(ctx.match[1], 10);
    const rule = getActiveRules(db, ctx.group.id).find((r) => r.id === ruleId);
    if (!rule) return;

    await ctx.editMessageText(
      `⚠️ <b>Видалити завдання "${rule.name}" (${dayNames(rule.schedule.split(","))})?</b>\n\nЦю дію не можна скасувати.`,
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "🗑 Так, видалити",
              `rule:delete:confirm:${ruleId}`,
            ),
          ],
          [Markup.button.callback("❌ Скасувати", "admin:delete_rule")],
        ]),
      },
    );
  });

  bot.action(/^rule:delete:confirm:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.group) return;
    const ruleId = parseInt(ctx.match[1], 10);
    deactivateRule(db, ruleId);

    const rules = getActiveRules(db, ctx.group.id);
    if (rules.length === 0) {
      await ctx.editMessageText("✅ Завдання видалено.", {
        ...Markup.inlineKeyboard([
          [Markup.button.callback("⬅️ Назад", "admin:overview")],
        ]),
      });
      return;
    }
    await ctx.editMessageText(
      "✅ Завдання видалено.\n\n🗑 <b>Оберіть завдання для видалення:</b>",
      {
        parse_mode: "HTML",
        ...deleteRuleKeyboard(rules),
      },
    );
  });

  bot.action("admin:add_member", async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.group || !ctx.chat) return;
    const msg = await ctx.reply(
      "👤 <b>Додати учасника</b>\n\nНадішліть команду:\n/add_member @нікнейм\nабо\n/add_member Ім'я\n\nПотім оберіть роль.",
      { parse_mode: "HTML" },
    );
    await trackAndPrune(
      ctx.telegram,
      db,
      ctx.group.id,
      ctx.chat.id,
      msg.message_id,
    );
  });

  bot.action("admin:reset", async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.group) return;
    await ctx.editMessageText(
      "⚠️ <b>Скинути все?</b>\n\nЦе видалить всіх учасників, завдання та всю історію чергувань. Група залишиться зареєстрованою, а ви — як Тато.",
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "🗑 Так, скинути все",
              "admin:reset:confirm",
            ),
          ],
          [Markup.button.callback("❌ Скасувати", "admin:menu")],
        ]),
      },
    );
  });

  bot.action("admin:reset:confirm", async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.group || ctx.member?.role !== "dad") return;

    const groupId = ctx.group.id;
    const name = ctx.from?.first_name ?? "Тато";
    const telegramId = ctx.from?.id;

    clearGroup(db, groupId);

    const dad = addMember(db, groupId, name, "dad");
    if (telegramId) linkMember(db, dad.id, telegramId);
    ctx.member = { ...dad, telegram_id: telegramId ?? null };

    await ctx.editMessageText(
      "✅ Все скинуто. Ви залишились як Тато. Додайте учасників та завдання.",
      {
        ...Markup.inlineKeyboard([
          [Markup.button.callback("⚙️ Меню", "admin:menu")],
        ]),
      },
    );
  });

  bot.action("admin:add_rule", async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.chat || !ctx.group) return;
    if (ctx.member?.role !== "dad" && ctx.member?.role !== "mom") {
      await ctx.answerCbQuery("Тільки батьки можуть керувати завданнями.");
      return;
    }
    initWizard(ctx.chat.id);
    await ctx.editMessageText("📝 <b>Крок 1: Оберіть назву завдання</b>", {
      parse_mode: "HTML",
      ...namePickerKeyboard(),
    });
  });

  bot.action(/^rule:back:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.chat || !ctx.group) return;
    const state = getWizard(ctx.chat.id);
    if (!state) return;

    const target = ctx.match[1];
    switch (target) {
      case "name":
        initWizard(ctx.chat.id);
        await ctx.editMessageText("📝 <b>Крок 1: Оберіть назву завдання</b>", {
          parse_mode: "HTML",
          ...namePickerKeyboard(),
        });
        break;
      case "days":
        updateWizard(ctx.chat.id, { step: "days" });
        await ctx.editMessageText(
          `📅 <b>${state.ruleName} — Крок 2: Оберіть дні тижня</b>\n\nНатискайте на дні, потім → Далі`,
          { parse_mode: "HTML", ...dayPickerKeyboard(state.selectedDays) },
        );
        break;
      case "workers": {
        const kidCount = getActiveKids(db, ctx.group.id).length;
        updateWizard(ctx.chat.id, { step: "workers" });
        await ctx.editMessageText(
          "👥 <b>Крок 2: Скільки дітей чергує за раз?</b>",
          { parse_mode: "HTML", ...workerCountKeyboard(kidCount) },
        );
        break;
      }
      case "split":
        if (state.remainingDays.length > 0) {
          updateWizard(ctx.chat.id, { step: "subset_days" });
          await ctx.editMessageText(
            `🔀 <b>${state.ruleName} — Оберіть дні для групи:</b>\n\nОберіть дні з однаковим розкладом чергування, потім → Далі`,
            {
              parse_mode: "HTML",
              ...subsetDayPickerKeyboard(
                state.remainingDays,
                state.currentSubsetDays,
              ),
            },
          );
        } else {
          updateWizard(ctx.chat.id, { step: "split" });
          await ctx.editMessageText(
            "📆 <b>Крок 3: Однакові умови для всіх вибраних днів?</b>",
            { parse_mode: "HTML", ...splitDaysKeyboard() },
          );
        }
        break;
      case "split_subset":
        updateWizard(ctx.chat.id, {
          step: "split",
          remainingDays: [],
          currentSubsetDays: [],
          completedSubsets: [],
        });
        await ctx.editMessageText(
          "📆 <b>Крок 3: Однакові умови для всіх вибраних днів?</b>",
          { parse_mode: "HTML", ...splitDaysKeyboard() },
        );
        break;
      case "rotation": {
        updateWizard(ctx.chat.id, { step: "rotation" });
        const text =
          state.remainingDays.length > 0
            ? `🔄 <b>Тип ротації для: ${dayNames(state.currentSubsetDays)}</b>`
            : "🔄 <b>Крок 4: Тип ротації</b>";
        await ctx.editMessageText(text, {
          parse_mode: "HTML",
          ...rotationModeKeyboard(),
        });
        break;
      }
    }
  });

  bot.action(/^rule:name:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.chat || !ctx.group) return;
    const state = getWizard(ctx.chat.id);
    if (!state) return;

    const raw = ctx.match[1];
    if (raw === "custom") {
      const msg = await ctx.reply("Введіть назву: /rule_name Назва завдання");
      await trackAndPrune(
        ctx.telegram,
        db,
        ctx.group.id,
        ctx.chat.id,
        msg.message_id,
      );
      return;
    }

    const name = RULE_NAME_PRESETS[parseInt(raw, 10)];
    if (!name) return;
    updateWizard(ctx.chat.id, { ruleName: name, step: "days" });
    await ctx.editMessageText(
      `📅 <b>${name} — Крок 2: Оберіть дні тижня</b>\n\nНатискайте на дні, потім → Далі`,
      { parse_mode: "HTML", ...dayPickerKeyboard([]) },
    );
  });

  bot.command("rule_name", async (ctx) => {
    if (!ctx.chat || !ctx.group) return;
    const state = getWizard(ctx.chat.id);
    if (!state || state.step !== "name") return;

    const name = ctx.message.text.split(" ").slice(1).join(" ").trim();
    if (!name) {
      const msg = await ctx.reply("Використання: /rule_name Назва завдання");
      await trackAndPrune(
        ctx.telegram,
        db,
        ctx.group.id,
        ctx.chat.id,
        msg.message_id,
      );
      return;
    }

    updateWizard(ctx.chat.id, { ruleName: name, step: "days" });
    const msg = await ctx.reply(
      `📅 <b>${name} — Крок 2: Оберіть дні тижня</b>\n\nНатискайте на дні, потім → Далі`,
      { parse_mode: "HTML", ...dayPickerKeyboard([]) },
    );
    await trackAndPrune(
      ctx.telegram,
      db,
      ctx.group.id,
      ctx.chat.id,
      msg.message_id,
    );
  });

  bot.action(/^rule:day:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.chat) return;
    const state = getWizard(ctx.chat.id);
    if (!state) return;

    const day = ctx.match[1];
    const days = state.selectedDays.includes(day)
      ? state.selectedDays.filter((d) => d !== day)
      : [...state.selectedDays, day];
    updateWizard(ctx.chat.id, { selectedDays: days });

    await ctx.editMessageReplyMarkup(dayPickerKeyboard(days).reply_markup);
  });

  bot.action("rule:days:confirm", async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.chat || !ctx.group) return;
    const state = getWizard(ctx.chat.id);
    if (!state || state.selectedDays.length === 0) {
      await ctx.answerCbQuery("Оберіть хоча б один день!");
      return;
    }
    const kidCount = getActiveKids(db, ctx.group.id).length;
    updateWizard(ctx.chat.id, { step: "workers" });
    await ctx.editMessageText(
      "👥 <b>Крок 2: Скільки дітей чергує за раз?</b>",
      { parse_mode: "HTML", ...workerCountKeyboard(kidCount) },
    );
  });

  bot.action(/^rule:workers:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.chat) return;
    const state = getWizard(ctx.chat.id);
    if (!state) return;

    updateWizard(ctx.chat.id, {
      workersCount: parseInt(ctx.match[1], 10),
      step: "split",
    });
    await ctx.editMessageText(
      "📆 <b>Крок 3: Однакові умови для всіх вибраних днів?</b>",
      { parse_mode: "HTML", ...splitDaysKeyboard() },
    );
  });

  bot.action("rule:split:all", async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.chat) return;
    updateWizard(ctx.chat.id, {
      step: "rotation",
      remainingDays: [],
      currentSubsetDays: [],
      completedSubsets: [],
    });
    await ctx.editMessageText("🔄 <b>Крок 4: Тип ротації</b>", {
      parse_mode: "HTML",
      ...rotationModeKeyboard(),
    });
  });

  bot.action("rule:split:subset", async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.chat) return;
    const state = getWizard(ctx.chat.id);
    if (!state) return;

    updateWizard(ctx.chat.id, {
      step: "subset_days",
      remainingDays: [...state.selectedDays],
      currentSubsetDays: [],
      completedSubsets: [],
    });
    await ctx.editMessageText(
      `🔀 <b>${state.ruleName} — Оберіть дні для групи:</b>\n\nОберіть дні з однаковим розкладом чергування, потім → Далі`,
      {
        parse_mode: "HTML",
        ...subsetDayPickerKeyboard(state.selectedDays, []),
      },
    );
  });

  bot.action(/^rule:subsetday:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.chat) return;
    const state = getWizard(ctx.chat.id);
    if (!state) return;

    const day = ctx.match[1];
    if (!state.remainingDays.includes(day)) return;
    const days = state.currentSubsetDays.includes(day)
      ? state.currentSubsetDays.filter((d) => d !== day)
      : [...state.currentSubsetDays, day];
    updateWizard(ctx.chat.id, { currentSubsetDays: days });

    await ctx.editMessageReplyMarkup(
      subsetDayPickerKeyboard(state.remainingDays, days).reply_markup,
    );
  });

  bot.action("rule:subset:confirm", async (ctx) => {
    if (!ctx.chat) {
      await ctx.answerCbQuery();
      return;
    }
    const state = getWizard(ctx.chat.id);
    if (!state || state.currentSubsetDays.length === 0) {
      await ctx.answerCbQuery("Оберіть хоча б один день!", {
        show_alert: true,
      });
      return;
    }

    await ctx.answerCbQuery();
    updateWizard(ctx.chat.id, { step: "rotation" });
    await ctx.editMessageText(
      `🔄 <b>Тип ротації для: ${dayNames(state.currentSubsetDays)}</b>`,
      { parse_mode: "HTML", ...rotationModeKeyboard() },
    );
  });

  bot.action(/^rule:rotation:(round_robin|fixed|all)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.chat || !ctx.group) return;
    const state = getWizard(ctx.chat.id);
    if (!state) return;

    const mode = ctx.match[1] as "round_robin" | "fixed" | "all";
    const splitMode = state.remainingDays.length > 0;
    updateWizard(ctx.chat.id, { rotationMode: mode });

    if (mode === "fixed") {
      const kids = getActiveKids(db, ctx.group.id);
      updateWizard(ctx.chat.id, { step: "fixed_members", fixedMembers: [] });
      const header = splitMode
        ? `👤 <b>Оберіть чергових на: ${dayNames(state.currentSubsetDays)}</b>`
        : "👤 <b>Крок 5: Оберіть фіксованих чергових</b>";
      await ctx.editMessageText(
        `${header}\n\nПотрібно обрати: ${state.workersCount} чол.`,
        { parse_mode: "HTML", ...fixedMembersKeyboard(kids, []) },
      );
    } else if (splitMode) {
      await completeSubset(ctx, db, mode, []);
    } else {
      await showConfirmation(ctx, db);
    }
  });

  bot.action(/^rule:member:(\d+)$/, async (ctx) => {
    if (!ctx.chat || !ctx.group) {
      await ctx.answerCbQuery();
      return;
    }
    const state = getWizard(ctx.chat.id);
    if (!state) {
      await ctx.answerCbQuery();
      return;
    }

    const memberId = parseInt(ctx.match[1], 10);
    let ids: number[];
    if (state.fixedMembers.includes(memberId)) {
      ids = state.fixedMembers.filter((id) => id !== memberId);
    } else {
      ids = [...state.fixedMembers, memberId];
      if (ids.length > state.workersCount) {
        ids = ids.slice(ids.length - state.workersCount);
      }
    }
    updateWizard(ctx.chat.id, { fixedMembers: ids });
    await ctx.answerCbQuery(`Обрано: ${ids.length} з ${state.workersCount}`);

    const kids = getActiveKids(db, ctx.group.id);
    await ctx.editMessageReplyMarkup(
      fixedMembersKeyboard(kids, ids).reply_markup,
    );
  });

  bot.action("rule:save", async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.chat) return;
    const state = getWizard(ctx.chat.id);
    if (!state) return;

    if (state.remainingDays.length > 0) {
      await completeSubset(ctx, db, "fixed", state.fixedMembers);
    } else {
      await showConfirmation(ctx, db);
    }
  });

  bot.action("rule:confirm:save", async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.chat) return;
    const state = getWizard(ctx.chat.id);
    if (!state) return;

    if (state.completedSubsets.length > 0) {
      await saveSplitRules(ctx, db);
    } else {
      await saveRule(ctx, db);
    }
  });

  bot.action("rule:restart", async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.chat || !ctx.group) return;
    if (ctx.member?.role !== "dad" && ctx.member?.role !== "mom") return;

    initWizard(ctx.chat.id);
    await ctx.editMessageText("📝 <b>Крок 1: Оберіть назву завдання</b>", {
      parse_mode: "HTML",
      ...namePickerKeyboard(),
    });
  });
}

async function showConfirmation(
  ctx: BotContext,
  db: Database.Database,
): Promise<void> {
  if (!ctx.chat || !ctx.group) return;
  const state = getWizard(ctx.chat.id);
  if (!state) return;

  updateWizard(ctx.chat.id, { step: "confirm" });

  const kids = getActiveKids(db, ctx.group.id);
  const membersMap = Object.fromEntries(kids.map((k) => [k.id, k.name]));

  let summary: string;
  if (state.completedSubsets.length > 0) {
    summary = state.completedSubsets
      .map((subset) => {
        let line = `${dayNames(subset.days)}: ${MODE_LABEL[subset.rotationMode]}`;
        if (subset.rotationMode === "fixed") {
          const names = subset.fixedMembers
            .map((id) => membersMap[id] ?? "?")
            .join(", ");
          line += ` — ${names}`;
        }
        return line;
      })
      .join("\n");
  } else {
    const mode = state.rotationMode ?? "round_robin";
    summary = `📅 Дні: ${dayNames(state.selectedDays)}\n🔄 Тип: ${MODE_LABEL[mode]}`;
    if (mode === "fixed") {
      const names = state.fixedMembers
        .map((id) => membersMap[id] ?? "?")
        .join(", ");
      summary += `\n👤 Чергові: ${names}`;
    }
  }

  await ctx.editMessageText(
    `✅ <b>Перевірте налаштування "${state.ruleName}"</b>\n👥 Чергових: ${state.workersCount}\n\n${summary}\n\nВсе вірно?`,
    { parse_mode: "HTML", ...confirmRuleKeyboard() },
  );
}

async function saveRule(ctx: BotContext, db: Database.Database) {
  if (!ctx.chat || !ctx.group) return;
  const state = getWizard(ctx.chat.id);
  if (!state || !state.rotationMode) return;

  const schedule = state.selectedDays.join(",");
  const rule = createRule(
    db,
    ctx.group.id,
    state.ruleName,
    schedule,
    state.workersCount,
    state.rotationMode,
  );

  if (state.rotationMode === "fixed") {
    setFixedAssignments(db, rule.id, state.fixedMembers);
  }

  clearWizard(ctx.chat.id);

  await ctx.editMessageText(
    `✅ <b>Завдання збережено!</b>\n📌 Розклад: ${schedule}\n👥 Чергових: ${state.workersCount}\n🔄 Тип: ${state.rotationMode}`,
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("⚙️ Меню", "admin:menu")],
      ]),
    },
  );
}

async function completeSubset(
  ctx: BotContext,
  db: Database.Database,
  mode: "round_robin" | "fixed" | "all",
  fixedMembers: number[],
): Promise<void> {
  if (!ctx.chat || !ctx.group) return;
  const state = getWizard(ctx.chat.id);
  if (!state) return;

  const completedSubsets = [
    ...state.completedSubsets,
    {
      days: state.currentSubsetDays,
      workersCount: state.workersCount,
      rotationMode: mode,
      fixedMembers,
    },
  ];
  const remainingDays = state.remainingDays.filter(
    (d) => !state.currentSubsetDays.includes(d),
  );

  if (remainingDays.length === 0) {
    updateWizard(ctx.chat.id, {
      completedSubsets,
      remainingDays,
      currentSubsetDays: [],
    });
    await showConfirmation(ctx, db);
    return;
  }

  updateWizard(ctx.chat.id, {
    completedSubsets,
    remainingDays,
    currentSubsetDays: [],
    step: "subset_days",
  });
  await ctx.editMessageText(
    `🔀 <b>${state.ruleName} — Залишилось налаштувати дні:</b>\n\nОберіть дні з однаковим розкладом чергування, потім → Далі`,
    { parse_mode: "HTML", ...subsetDayPickerKeyboard(remainingDays, []) },
  );
}

async function saveSplitRules(
  ctx: BotContext,
  db: Database.Database,
): Promise<void> {
  if (!ctx.chat || !ctx.group) return;
  const state = getWizard(ctx.chat.id);
  if (!state) return;
  const groupId = ctx.group.id;

  const kids = getActiveKids(db, groupId);
  const membersMap = Object.fromEntries(kids.map((k) => [k.id, k.name]));

  const summaryLines = state.completedSubsets.map((subset) => {
    const schedule = subset.days.join(",");
    const rule = createRule(
      db,
      groupId,
      state.ruleName,
      schedule,
      subset.workersCount,
      subset.rotationMode,
    );
    if (subset.rotationMode === "fixed") {
      setFixedAssignments(db, rule.id, subset.fixedMembers);
    }
    let line = `${dayNames(subset.days)}: ${MODE_LABEL[subset.rotationMode]}`;
    if (subset.rotationMode === "fixed") {
      const names = subset.fixedMembers
        .map((id) => membersMap[id] ?? "?")
        .join(", ");
      line += ` — ${names}`;
    }
    return line;
  });

  clearWizard(ctx.chat.id);

  await ctx.editMessageText(
    `✅ <b>Завдання "${state.ruleName}" збережено!</b>\n👥 Чергових: ${state.workersCount}\n\n${summaryLines.join("\n")}`,
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("⚙️ Меню", "admin:menu")],
      ]),
    },
  );
}
