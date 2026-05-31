import { Markup } from 'telegraf';

export function setupWelcomeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🏠 Налаштувати сім\'ю', 'setup:start')],
  ]);
}

export function addMemberRoleKeyboard(tempName: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('👩 Мама', `setup:role:${encodeURIComponent(tempName)}:mom`)],
    [Markup.button.callback('🧒 Дитина', `setup:role:${encodeURIComponent(tempName)}:kid`)],
  ]);
}

export function adminMenuKeyboard(hasKids: boolean) {
  const buttons = [];
  if (hasKids) buttons.push([Markup.button.callback('➕ Додати завдання', 'admin:add_rule')]);
  buttons.push([Markup.button.callback('👤 Додати учасника', 'admin:add_member')]);
  buttons.push([Markup.button.callback('👥 Члени сім\'ї', 'admin:members')]);
  return Markup.inlineKeyboard(buttons);
}
