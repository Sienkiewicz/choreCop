import "dotenv/config";
import { getDb } from "../src/db/index.js";
import {
  upsertGroup,
  addMember,
  getAllMembers,
  getActiveKids,
} from "../src/db/groups.js";
import { createRule, getActiveRules } from "../src/db/rules.js";
import type { WorkRule } from "../src/types.js";
import { Role, RotationMode } from "../src/types.js";

const db = getDb();
const [, , command, ...args] = process.argv;

function usage() {
  console.log(`
Usage:
  tsx scripts/setup.ts setup <chat_id> <family_name>
  tsx scripts/setup.ts add-member <chat_id> <name> <mom|kid>
  tsx scripts/setup.ts add-rule <chat_id> <name> <schedule> <workers> <round_robin|all|fixed>
  tsx scripts/setup.ts list <chat_id>

Examples:
  tsx scripts/setup.ts setup -- -1234567890 "Сім'я Доу"
  tsx scripts/setup.ts add-member -- -1234567890 "Оля" mom
  tsx scripts/setup.ts add-member -- -1234567890 "Аня" kid
  tsx scripts/setup.ts add-rule -- -1234567890 "Посудомийна" daily 1 round_robin
  tsx scripts/setup.ts add-rule -- -1234567890 "Прибирання" sat 4 all
  tsx scripts/setup.ts list -- -1234567890
`);
  process.exit(1);
}

const chatId = parseInt(args[0], 10);
if (!command || isNaN(chatId)) usage();

const group = () => {
  const g = db.prepare("SELECT * FROM groups WHERE chat_id = ?").get(chatId) as
    | { id: number; name: string }
    | undefined;
  if (!g) {
    console.error(`No group for chat_id ${chatId}. Run setup first.`);
    process.exit(1);
  }
  return g;
};

switch (command) {
  case "setup": {
    const name = args[1];
    if (!name) usage();
    const g = upsertGroup(db, chatId, name);
    const existing = getAllMembers(db, g.id).find((m) => m.role === Role.Dad);
    if (existing) {
      console.log(`Group "${g.name}" already exists. Dad: ${existing.name}`);
    } else {
      addMember(db, g.id, "Тато", Role.Dad);
      console.log(`✅ Group "${g.name}" created with dad.`);
    }
    break;
  }

  case "add-member": {
    const [, name, role] = args;
    if (!name || !([Role.Mom, Role.Kid] as string[]).includes(role)) usage();
    const g = group();
    const kidOrder =
      role === Role.Kid ? getActiveKids(db, g.id).length + 1 : undefined;
    const member = addMember(db, g.id, name, role as Role, kidOrder);
    console.log(
      `✅ Added "${member.name}" as ${member.role}${kidOrder ? ` (kid #${kidOrder})` : ""}.`,
    );
    break;
  }

  case "add-rule": {
    const [, name, schedule, workersStr, mode] = args;
    const workers = parseInt(workersStr, 10);
    if (
      !name ||
      !schedule ||
      isNaN(workers) ||
      !(
        [
          RotationMode.RoundRobin,
          RotationMode.All,
          RotationMode.Fixed,
        ] as string[]
      ).includes(mode)
    )
      usage();
    const g = group();
    const rule = createRule(
      db,
      g.id,
      name,
      schedule,
      workers,
      mode as WorkRule["rotation_mode"],
    );
    console.log(
      `✅ Rule "${rule.name}": ${schedule}, ${workers} worker(s), ${mode}.`,
    );
    break;
  }

  case "list": {
    const g = group();
    const members = getAllMembers(db, g.id);
    const rules = getActiveRules(db, g.id);
    console.log(`\nGroup: ${g.name} (chat_id: ${chatId})\n`);
    console.log("Members:");
    members.forEach((m) =>
      console.log(
        `  ${m.id}. ${m.name} — ${m.role}${m.telegram_id ? " 🔗" : ""}`,
      ),
    );
    console.log("\nRules:");
    if (!rules.length) console.log("  (none)");
    rules.forEach((r) =>
      console.log(
        `  ${r.id}. ${r.name} — ${r.schedule}, ${r.workers_count} worker(s), ${r.rotation_mode}`,
      ),
    );
    console.log("");
    break;
  }

  default:
    usage();
}

db.close();
