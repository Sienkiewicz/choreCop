import type { Telegraf } from 'telegraf';
import Database from 'better-sqlite3';
import type { BotContext } from '../context';
import { registerRegistrationHandlers } from './registration';
import { registerAdminHandlers } from './admin';
import { registerDutyHandlers } from './duties';
import { registerDevHandlers } from './dev';

export function registerHandlers(bot: Telegraf<BotContext>, db: Database.Database): void {
  registerRegistrationHandlers(bot, db);
  registerAdminHandlers(bot, db);
  registerDutyHandlers(bot, db);
  if (process.env.NODE_ENV !== 'production') registerDevHandlers(bot, db);
}
