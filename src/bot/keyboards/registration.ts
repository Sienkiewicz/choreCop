import { Markup } from 'telegraf';
import type { Member } from '../../types.js';

export function setupWelcomeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🏠 Налаштувати сім\'ю', 'setup:start')],
  ]);
}

export function addMemberRoleKeyboard(tempName: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('👨 Тато', `setup:role:${encodeURIComponent(tempName)}:dad`)],
    [Markup.button.callback('👩 Мама', `setup:role:${encodeURIComponent(tempName)}:mom`)],
    [Markup.button.callback('🧒 Дитина', `setup:role:${encodeURIComponent(tempName)}:kid`)],
  ]);
}

export function linkAccountKeyboard(unlinkedMembers: Member[]) {
  const buttons = unlinkedMembers.map(m => [
    Markup.button.callback(`👤 ${m.name}`, `link:${m.id}`),
  ]);
  return Markup.inlineKeyboard(buttons);
}

export function adminMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('➕ Додати завдання', 'admin:add_rule')],
    [Markup.button.callback('👥 Члени сім\'ї', 'admin:members')],
  ]);
}
