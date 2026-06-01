import { Markup } from 'telegraf';

export function setupWelcomeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🏠 Налаштувати сім\'ю', 'setup:start')],
  ]);
}

export function miniAppKeyboard(url: string) {
  return Markup.inlineKeyboard([
    [Markup.button.webApp('⚙️ Відкрити налаштування', url)],
  ]);
}
