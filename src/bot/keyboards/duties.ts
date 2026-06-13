import { Markup } from "telegraf";
import Database from "better-sqlite3";
import type { Duty, Member } from "@src/types";
import { DutyStatus, Gender } from "@src/types";
import { getAllMembers } from "@src/db/groups";
import { getActiveRules } from "@src/db/rules";

interface MessagePayload {
  text: string;
  reply_markup: ReturnType<typeof Markup.inlineKeyboard>["reply_markup"];
}

export function memberTag(m: Member): string {
  return m.username ? `@${m.username}` : m.name;
}

export function doneLabel(m: Member): string {
  const verb = m.gender === Gender.Female ? "виконала" : "виконав";
  return `${memberTag(m)} ${verb}`;
}

function statusIcon(status: Duty["status"]): string {
  switch (status) {
    case DutyStatus.Done:
      return "✅";
    case DutyStatus.ApprovalPending:
      return "⏳";
    case DutyStatus.Rejected:
      return "❌";
    default:
      return "⬜";
  }
}

const MONTHS_UA = [
  "січня",
  "лютого",
  "березня",
  "квітня",
  "травня",
  "червня",
  "липня",
  "серпня",
  "вересня",
  "жовтня",
  "листопада",
  "грудня",
];

function formatDate(dateStr: string): [string, string] {
  const [, m, d] = dateStr.split("-");
  return [String(parseInt(d, 10)), MONTHS_UA[parseInt(m, 10) - 1]];
}

function groupByRule(duties: Duty[]): Map<number, Duty[]> {
  const map = new Map<number, Duty[]>();
  for (const d of duties) {
    if (!map.has(d.rule_id)) map.set(d.rule_id, []);
    map.get(d.rule_id)!.push(d);
  }
  return map;
}

export function buildSummaryMessage(
  db: Database.Database,
  groupId: number,
  duties: Duty[],
  date: string,
): MessagePayload {
  const membersMap = Object.fromEntries(
    getAllMembers(db, groupId).map((m) => [m.id, m]),
  );
  const rules = Object.fromEntries(
    getActiveRules(db, groupId).map((r) => [r.id, r.name]),
  );

  const [day, month] = formatDate(date);
  let text = `📋 <b>Чергування на сьогодні, ${day} ${month}:</b>\n\n`;

  for (const [ruleId, ruleDuties] of groupByRule(duties)) {
    const ruleName = rules[ruleId] ?? "???";
    const parts = ruleDuties
      .map(
        (d) => `${statusIcon(d.status)} ${memberTag(membersMap[d.member_id])}`,
      )
      .join("  ");
    text += `${ruleName} — ${parts}\n`;
  }

  const hasPending = duties.some(
    (d) =>
      d.status === DutyStatus.Pending ||
      d.status === DutyStatus.ApprovalPending,
  );
  const buttons = hasPending
    ? [[Markup.button.callback("✅ Позначити виконане", `menu:done:${date}`)]]
    : [];

  return { text, reply_markup: Markup.inlineKeyboard(buttons).reply_markup };
}

export function buildReminderMessage(
  db: Database.Database,
  groupId: number,
  pendingDuties: Duty[],
  date: string,
): MessagePayload {
  const membersMap = Object.fromEntries(
    getAllMembers(db, groupId).map((m) => [m.id, m]),
  );
  const rules = Object.fromEntries(
    getActiveRules(db, groupId).map((r) => [r.id, r.name]),
  );

  let text = `⏰ <b>Нагадування — ще не виконано:</b>\n\n`;

  for (const [ruleId, ruleDuties] of groupByRule(pendingDuties)) {
    const ruleName = rules[ruleId] ?? "???";
    const parts = ruleDuties
      .map((d) => memberTag(membersMap[d.member_id]))
      .join("  ");
    text += `📌 ${ruleName} — ${parts}\n`;
  }

  return {
    text,
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback("✅ Позначити виконане", `menu:done:${date}`)],
    ]).reply_markup,
  };
}

export function buildTaskListMessage(
  pendingDuties: Duty[],
  membersMap: Record<number, Member>,
  rulesMap: Record<number, string>,
): MessagePayload {
  const text = "📋 <b>Оберіть завдання:</b>";
  const buttons = pendingDuties.map((d) => [
    Markup.button.callback(
      `${rulesMap[d.rule_id] ?? "?"} — ${doneLabel(membersMap[d.member_id])}`,
      `done:${d.id}`,
    ),
  ]);
  return { text, reply_markup: Markup.inlineKeyboard(buttons).reply_markup };
}

export function buildApprovalMessage(
  requester: Member,
  dutyOwner: Member,
  ruleName: string,
  dutyId: number,
): MessagePayload {
  const text = `⚠️ <b>${memberTag(requester)}</b> хоче відмітити завдання <b>${memberTag(dutyOwner)}</b> (${ruleName}) як виконане.`;
  const buttons = [
    [
      Markup.button.callback("✅ Схвалити", `approve:${dutyId}`),
      Markup.button.callback("❌ Відхилити", `reject:${dutyId}`),
    ],
  ];
  return { text, reply_markup: Markup.inlineKeyboard(buttons).reply_markup };
}
