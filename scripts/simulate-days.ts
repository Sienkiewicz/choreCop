import "dotenv/config";
import { Telegraf } from "telegraf";
import Database from "better-sqlite3";
import path from "path";
import { applySchema } from "../src/db/schema";
import { getAllGroups } from "../src/db/groups";
import { generateDutiesForDate, toDateStr } from "../src/scheduler/generate";
import { sendDailySummary, sendReminder } from "../src/scheduler/reminders";
import type { BotContext } from "../src/bot/context";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => a.replace("--", "").split("=")),
);

const DAYS = parseInt(args["days"] ?? "7", 10);
const STEP_DELAY = parseInt(args["step-delay"] ?? "2", 10) * 1000;
const DAY_DELAY = parseInt(args["day-delay"] ?? "10", 10) * 1000;
const START_DATE = args["start"] ?? toDateStr(new Date());

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is required");

const DB_PATH =
  process.env.DATABASE_PATH ?? path.join(process.cwd(), "chorecop.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
applySchema(db);

const bot = new Telegraf<BotContext>(BOT_TOKEN);

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

async function runDay(dateStr: string, dayNum: number): Promise<void> {
  const groups = getAllGroups(db);
  const date = new Date(dateStr);

  console.log(`\n── Day ${dayNum}: ${dateStr} ${"─".repeat(30)}`);

  console.log("  [00:01] Generating duties...");
  groups.forEach((g) => generateDutiesForDate(db, g.id, date));

  await sleep(STEP_DELAY);

  console.log("  [08:00] Sending daily summary...");
  await sendDailySummary(bot, db, dateStr);

  await sleep(STEP_DELAY);

  console.log("  [14:00] Sending reminder...");
  await sendReminder(bot, db, dateStr);

  await sleep(STEP_DELAY);

  console.log("  [18:00] Sending final reminder...");
  await sendReminder(bot, db, dateStr);
}

async function main() {
  console.log(`Simulating ${DAYS} days from ${START_DATE}`);
  console.log(
    `Step delay: ${STEP_DELAY / 1000}s  Day gap: ${DAY_DELAY / 1000}s`,
  );
  console.log("Press Ctrl+C to stop.\n");

  for (let i = 0; i < DAYS; i++) {
    const dateStr = addDays(START_DATE, i);
    await runDay(dateStr, i + 1);

    if (i < DAYS - 1) {
      console.log(`\n  Waiting ${DAY_DELAY / 1000}s before next day...`);
      await sleep(DAY_DELAY);
    }
  }

  console.log("\nSimulation complete.");
  db.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
