import cron from 'node-cron';
import type { Telegram } from 'telegraf';
import Database from 'better-sqlite3';
import { getAllFamilies } from '../db/families.js';
import { generateDutiesForDate } from './generate.js';
import { sendDailySummary, sendReminder } from './reminders.js';

interface BotLike {
  telegram: Telegram;
}

export function registerCronJobs(bot: BotLike, db: Database.Database): void {
  cron.schedule('1 0 * * *', () => {
    const today = new Date();
    for (const family of getAllFamilies(db)) {
      generateDutiesForDate(db, family.id, today);
    }
  });

  cron.schedule('0 8 * * *', () => {
    sendDailySummary(bot, db).catch(console.error);
  });

  cron.schedule('0 14 * * *', () => {
    sendReminder(bot, db).catch(console.error);
  });

  cron.schedule('0 18 * * *', () => {
    sendReminder(bot, db).catch(console.error);
  });
}
