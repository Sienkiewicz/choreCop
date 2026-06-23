import { Markup } from "telegraf";

export function setupWelcomeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🏠 Налаштувати сім'ю", "setup:start")],
  ]);
}

export function addMemberRoleKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("👩 Мама", "setup:role:mom:female")],
    [Markup.button.callback("👦 Хлопець", "setup:role:kid:male")],
    [Markup.button.callback("👧 Дівчинка", "setup:role:kid:female")],
  ]);
}

export function adminMenuKeyboard(hasKids: boolean) {
  if (hasKids) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("➕ Додати завдання", "admin:add_rule"),
        Markup.button.callback("👤 Додати учасника", "admin:add_member"),
      ],
      [
        Markup.button.callback("👥 Члени сім'ї", "admin:members"),
        Markup.button.callback("📋 Поточні налаштування", "admin:overview"),
      ],
      [
        Markup.button.callback("📊 Звіт сьогодні", "admin:today"),
        Markup.button.callback("🗑 Скинути все", "admin:reset"),
      ],
    ]);
  }
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("👤 Додати учасника", "admin:add_member"),
      Markup.button.callback("👥 Члени сім'ї", "admin:members"),
    ],
    [
      Markup.button.callback("📋 Поточні налаштування", "admin:overview"),
      Markup.button.callback("📊 Звіт сьогодні", "admin:today"),
    ],
    [Markup.button.callback("🗑 Скинути все", "admin:reset")],
  ]);
}
