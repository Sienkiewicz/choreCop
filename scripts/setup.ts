import 'dotenv/config';
import { getDb } from '../src/db/index.js';
import { upsertFamily, addMember, getAllMembers, getActiveKids } from '../src/db/families.js';
import { createRule, getActiveRules } from '../src/db/rules.js';
import type { WorkRule } from '../src/types.js';

const db = getDb();
const [,, command, ...args] = process.argv;

function usage() {
  console.log(`
Usage:
  tsx scripts/setup.ts setup <chat_id> <family_name>
  tsx scripts/setup.ts add-member <chat_id> <name> <mom|kid>
  tsx scripts/setup.ts add-rule <chat_id> <name> <schedule> <workers> <round_robin|all|fixed>
  tsx scripts/setup.ts list <chat_id>

Examples:
  tsx scripts/setup.ts setup -- -1234567890 "Сім'я Сінкевич"
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

const family = () => {
  const f = db.prepare('SELECT * FROM families WHERE chat_id = ?').get(chatId) as { id: number; name: string } | undefined;
  if (!f) { console.error(`No family for chat_id ${chatId}. Run setup first.`); process.exit(1); }
  return f;
};

switch (command) {
  case 'setup': {
    const name = args[1];
    if (!name) usage();
    const f = upsertFamily(db, chatId, name);
    const existing = getAllMembers(db, f.id).find(m => m.role === 'dad');
    if (existing) {
      console.log(`Family "${f.name}" already exists. Dad: ${existing.name}`);
    } else {
      addMember(db, f.id, 'Тато', 'dad');
      console.log(`✅ Family "${f.name}" created with dad.`);
    }
    break;
  }

  case 'add-member': {
    const name = args[1];
    const role = args[2] as 'mom' | 'kid';
    if (!name || !['mom', 'kid'].includes(role)) usage();
    const f = family();
    const kidOrder = role === 'kid' ? getActiveKids(db, f.id).length + 1 : undefined;
    const member = addMember(db, f.id, name, role, kidOrder);
    console.log(`✅ Added "${member.name}" as ${member.role}${kidOrder ? ` (kid #${kidOrder})` : ''}.`);
    break;
  }

  case 'add-rule': {
    const [, name, schedule, workersStr, mode] = args;
    const workers = parseInt(workersStr, 10);
    if (!name || !schedule || isNaN(workers) || !['round_robin', 'all', 'fixed'].includes(mode)) usage();
    const f = family();
    const rule = createRule(db, f.id, name, schedule, workers, mode as WorkRule['rotation_mode']);
    console.log(`✅ Rule "${rule.name}": ${schedule}, ${workers} worker(s), ${mode}.`);
    break;
  }

  case 'list': {
    const f = family();
    const members = getAllMembers(db, f.id);
    const rules = getActiveRules(db, f.id);
    console.log(`\nFamily: ${f.name} (chat_id: ${chatId})\n`);
    console.log('Members:');
    members.forEach(m => console.log(`  ${m.id}. ${m.name} — ${m.role}${m.telegram_id ? ' 🔗' : ''}`));
    console.log('\nRules:');
    if (!rules.length) console.log('  (none)');
    rules.forEach(r => console.log(`  ${r.id}. ${r.name} — ${r.schedule}, ${r.workers_count} worker(s), ${r.rotation_mode}`));
    console.log('');
    break;
  }

  default:
    usage();
}

db.close();
