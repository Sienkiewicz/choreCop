import type { Telegraf } from 'telegraf';
import Database from 'better-sqlite3';
import type { BotContext } from '../context.js';
import { registerRegistrationHandlers } from './registration.js';
import { registerDutyHandlers } from './duties.js';
import { registerDevHandlers } from './dev.js';

export function registerHandlers(bot: Telegraf<BotContext>, db: Database.Database): void {
  registerRegistrationHandlers(bot, db);
  registerDutyHandlers(bot, db);
  if (process.env.NODE_ENV !== 'production') registerDevHandlers(bot, db);
}
