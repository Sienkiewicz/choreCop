import { Markup } from 'telegraf';
import type { Member } from '../../types.js';

const ALL_DAYS = ['mon','tue','wed','thu','fri','sat','sun'];
const DAY_LABELS: Record<string, string> = {
  mon: 'Пн', tue: 'Вт', wed: 'Ср', thu: 'Чт', fri: 'Пт', sat: 'Сб', sun: 'Нд',
};

export function dayPickerKeyboard(selectedDays: string[]) {
  const dayButtons = ALL_DAYS.map(d => {
    const selected = selectedDays.includes(d);
    return Markup.button.callback(
      `${selected ? '✅' : '⬜'} ${DAY_LABELS[d]}`,
      `rule:day:${d}`,
    );
  });

  const rows = [
    dayButtons.slice(0, 4),
    dayButtons.slice(4),
    [Markup.button.callback('➡️ Далі', 'rule:days:confirm')],
  ];
  return Markup.inlineKeyboard(rows);
}

export function workerCountKeyboard(kidCount: number) {
  const options = Array.from({ length: kidCount }, (_, i) => i + 1);
  return Markup.inlineKeyboard([
    options.map(n => Markup.button.callback(`${n}`, `rule:workers:${n}`)),
  ]);
}

export function splitDaysKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Так, однакові', 'rule:split:all')],
    [Markup.button.callback('🔀 Розділити дні', 'rule:split:subset')],
  ]);
}

export function rotationModeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔄 По черзі (1 за 1)', 'rule:rotation:round_robin')],
    [Markup.button.callback('📌 Фіксовані особи', 'rule:rotation:fixed')],
    [Markup.button.callback('👥 Всі діти', 'rule:rotation:all')],
  ]);
}

export function fixedMembersKeyboard(kids: Member[], selectedIds: number[]) {
  const buttons = kids.map(k => [
    Markup.button.callback(
      `${selectedIds.includes(k.id) ? '✅' : '⬜'} ${k.name}`,
      `rule:member:${k.id}`,
    ),
  ]);
  buttons.push([Markup.button.callback('💾 Зберегти правило', 'rule:save')]);
  return Markup.inlineKeyboard(buttons);
}
