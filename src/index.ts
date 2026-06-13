import "dotenv/config";
import { Telegraf } from "telegraf";
import { getDb, closeDb } from "./db/index";
import { registerCronJobs } from "./scheduler/index";
import { registerHandlers } from "./bot/handlers/index";
import { groupMiddleware } from "./bot/middleware/group";
import { getAllGroups } from "./db/groups";
import { generateDutiesForDate } from "./scheduler/generate";
import type { BotContext } from "./bot/context";

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("BOT_TOKEN environment variable is required");

const db = getDb();
const bot = new Telegraf<BotContext>(BOT_TOKEN);

bot.use(groupMiddleware(db));
registerHandlers(bot, db);
registerCronJobs(bot, db);

bot.launch().then(() => {
  console.log("ChoreCop is running");
  const today = new Date();
  getAllGroups(db).forEach((group) =>
    generateDutiesForDate(db, group.id, today),
  );
});

process.once("SIGINT", () => {
  bot.stop("SIGINT");
  closeDb();
});
process.once("SIGTERM", () => {
  bot.stop("SIGTERM");
  closeDb();
});
