import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { getDb, closeDb } from './db/index.js';
import { registerCronJobs } from './scheduler/index.js';
import { registerHandlers } from './bot/handlers/index.js';
import { familyMiddleware } from './bot/middleware/family.js';
import { getAllFamilies } from './db/families.js';
import { generateDutiesForDate } from './scheduler/generate.js';
import { startWebServer } from './web/server.js';
import type { BotContext } from './bot/context.js';

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error('BOT_TOKEN environment variable is required');

const db = getDb();
const bot = new Telegraf<BotContext>(BOT_TOKEN);

bot.use(familyMiddleware(db));
registerHandlers(bot, db);
registerCronJobs(bot, db);

bot.launch().then(() => {
  console.log('ChoreCop is running');
  const today = new Date();
  getAllFamilies(db).forEach(family => generateDutiesForDate(db, family.id, today));
  startWebServer(db, parseInt(process.env.PORT ?? '3000', 10));
});

process.once('SIGINT', () => { bot.stop('SIGINT'); closeDb(); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); closeDb(); });
