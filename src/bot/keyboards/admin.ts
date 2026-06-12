import { Markup } from "telegraf";
import type { Member, WorkRule } from "../../types.js";

export const RULE_NAME_PRESETS = [
  "Посудомийна",
  "Прибирання",
  "Сміття",
  "Готування",
  "Магазин",
  "Прасування",
];

export function namePickerKeyboard() {
  const rows = RULE_NAME_PRESETS.map((name, i) => [
    Markup.button.callback(name, `rule:name:${i}`),
  ]);
  rows.push([Markup.button.callback("✏️ Власна назва", "rule:name:custom")]);
  rows.push([Markup.button.callback("⬅️ Назад", "admin:menu")]);
  return Markup.inlineKeyboard(rows);
}

const ALL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const DAY_LABELS: Record<string, string> = {
  mon: "Пн",
  tue: "Вт",
  wed: "Ср",
  thu: "Чт",
  fri: "Пт",
  sat: "Сб",
  sun: "Нд",
};

export const MODE_LABEL: Record<string, string> = {
  round_robin: "🔄 По черзі",
  fixed: "📌 Фіксовані",
  all: "👥 Всі діти",
};

export const ROLE_LABEL: Record<string, string> = {
  dad: "👨 Тато",
  mom: "👩 Мама",
  kid: "🧒 Дитина",
};

export function dayNames(days: string[]): string {
  return days.map((d) => DAY_LABELS[d] ?? d).join(", ");
}

export function dayPickerKeyboard(selectedDays: string[]) {
  const dayButtons = ALL_DAYS.map((d) => {
    const selected = selectedDays.includes(d);
    return Markup.button.callback(
      `${selected ? "✅" : "⬜"} ${DAY_LABELS[d]}`,
      `rule:day:${d}`,
    );
  });

  const rows = [
    dayButtons.slice(0, 4),
    dayButtons.slice(4),
    [Markup.button.callback("➡️ Далі", "rule:days:confirm")],
    [Markup.button.callback("⬅️ Назад", "rule:back:name")],
  ];
  return Markup.inlineKeyboard(rows);
}

export function workerCountKeyboard(kidCount: number) {
  const options = Array.from({ length: kidCount }, (_, i) => i + 1);
  return Markup.inlineKeyboard([
    options.map((n) => Markup.button.callback(`${n}`, `rule:workers:${n}`)),
    [Markup.button.callback("⬅️ Назад", "rule:back:days")],
  ]);
}

export function splitDaysKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("✅ Так, однакові", "rule:split:all")],
    [Markup.button.callback("🔀 Розділити дні", "rule:split:subset")],
    [Markup.button.callback("⬅️ Назад", "rule:back:workers")],
  ]);
}

export function subsetDayPickerKeyboard(
  remainingDays: string[],
  selectedDays: string[],
) {
  const dayButtons = remainingDays.map((d) => {
    const selected = selectedDays.includes(d);
    return Markup.button.callback(
      `${selected ? "✅" : "⬜"} ${DAY_LABELS[d]}`,
      `rule:subsetday:${d}`,
    );
  });

  const rows = [
    dayButtons.slice(0, 4),
    dayButtons.slice(4),
    [Markup.button.callback("➡️ Далі", "rule:subset:confirm")],
    [Markup.button.callback("⬅️ Назад", "rule:back:split_subset")],
  ].filter((row) => row.length > 0);

  return Markup.inlineKeyboard(rows);
}

export function rotationModeKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "🔄 По черзі (1 за 1)",
        "rule:rotation:round_robin",
      ),
    ],
    [Markup.button.callback("📌 Фіксовані особи", "rule:rotation:fixed")],
    [Markup.button.callback("👥 Всі діти", "rule:rotation:all")],
    [Markup.button.callback("⬅️ Назад", "rule:back:split")],
  ]);
}

export function fixedMembersKeyboard(kids: Member[], selectedIds: number[]) {
  const buttons = kids.map((k) => [
    Markup.button.callback(
      `${selectedIds.includes(k.id) ? "✅" : "⬜"} ${k.name}`,
      `rule:member:${k.id}`,
    ),
  ]);
  buttons.push([Markup.button.callback("💾 Зберегти правило", "rule:save")]);
  buttons.push([Markup.button.callback("⬅️ Назад", "rule:back:rotation")]);
  return Markup.inlineKeyboard(buttons);
}

export function confirmRuleKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("✅ Так, зберегти", "rule:confirm:save")],
    [Markup.button.callback("🔄 Почати заново", "rule:restart")],
  ]);
}

export function deleteRuleKeyboard(rules: WorkRule[]) {
  const buttons = rules.map((r) => [
    Markup.button.callback(
      `🗑 ${r.name} (${dayNames(r.schedule.split(","))})`,
      `rule:delete:${r.id}`,
    ),
  ]);
  buttons.push([Markup.button.callback("⬅️ Назад", "admin:overview")]);
  return Markup.inlineKeyboard(buttons);
}
