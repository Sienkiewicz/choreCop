import { Markup } from 'telegraf';
import Database from 'better-sqlite3';
import type { Duty } from '../../types.js';
import { getAllMembers } from '../../db/families.js';
import { getActiveRules } from '../../db/rules.js';

interface MessagePayload {
  text: string;
  reply_markup: ReturnType<typeof Markup.inlineKeyboard>['reply_markup'];
}

export function buildSummaryMessage(
  db: Database.Database,
  familyId: number,
  duties: Duty[],
  date: string,
): MessagePayload {
  const members = Object.fromEntries(
    getAllMembers(db, familyId).map(m => [m.id, m.name])
  );
  const rules = Object.fromEntries(
    getActiveRules(db, familyId).map(r => [r.id, r.name])
  );

  const [day, month] = formatDate(date);
  let text = `📋 <b>Чергування на сьогодні, ${day} ${month}:</b>\n\n`;
  const buttons: ReturnType<typeof Markup.button.callback>[][] = [];

  for (const duty of duties) {
    const memberName = members[duty.member_id] ?? '???';
    const ruleName = rules[duty.rule_id] ?? '???';
    const statusEmoji = statusIcon(duty.status);
    text += `${statusEmoji} ${ruleName} — ${memberName}\n`;
    if (duty.status === 'pending') {
      buttons.push([Markup.button.callback(`✅ ${memberName} виконав`, `done:${duty.id}`)]);
    }
  }

  return { text, reply_markup: Markup.inlineKeyboard(buttons).reply_markup };
}

export function buildReminderMessage(
  db: Database.Database,
  familyId: number,
  pendingDuties: Duty[],
  date: string,
): MessagePayload {
  const members = Object.fromEntries(
    getAllMembers(db, familyId).map(m => [m.id, m.name])
  );
  const rules = Object.fromEntries(
    getActiveRules(db, familyId).map(r => [r.id, r.name])
  );

  let text = `⏰ <b>Нагадування — ще не виконано:</b>\n\n`;
  const buttons: ReturnType<typeof Markup.button.callback>[][] = [];

  for (const duty of pendingDuties) {
    const memberName = members[duty.member_id] ?? '???';
    const ruleName = rules[duty.rule_id] ?? '???';
    text += `📌 ${ruleName} — ${memberName}\n`;
    buttons.push([Markup.button.callback(`✅ ${memberName} виконав`, `done:${duty.id}`)]);
  }

  return { text, reply_markup: Markup.inlineKeyboard(buttons).reply_markup };
}

export function buildApprovalMessage(
  requesterName: string,
  dutyOwnerName: string,
  ruleName: string,
  dutyId: number,
): MessagePayload {
  const text = `⚠️ <b>${requesterName}</b> хоче відмітити завдання <b>${dutyOwnerName}</b> (${ruleName}) як виконане.`;
  const buttons = [[
    Markup.button.callback('✅ Схвалити', `approve:${dutyId}`),
    Markup.button.callback('❌ Відхилити', `reject:${dutyId}`),
  ]];
  return { text, reply_markup: Markup.inlineKeyboard(buttons).reply_markup };
}

function statusIcon(status: Duty['status']): string {
  switch (status) {
    case 'done': return '✅';
    case 'approval_pending': return '⏳';
    case 'rejected': return '❌';
    default: return '⬜';
  }
}

const MONTHS_UA = [
  'січня','лютого','березня','квітня','травня','червня',
  'липня','серпня','вересня','жовтня','листопада','грудня',
];

function formatDate(dateStr: string): [string, string] {
  const [, m, d] = dateStr.split('-');
  return [String(parseInt(d, 10)), MONTHS_UA[parseInt(m, 10) - 1]];
}
