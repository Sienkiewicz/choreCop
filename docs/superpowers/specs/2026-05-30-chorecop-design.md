# ChoreCop — Design Spec

**Date:** 2026-05-30  
**Status:** Approved

---

## Overview

ChoreCop is a Telegram group bot for family chore management. It tracks daily duty rotations, sends reminders, collects done confirmations, and manages approval flows — all through inline buttons, with zero free-text input. A single bot instance serves multiple families; each family is scoped to its own Telegram group chat.

---

## Stack

| Concern | Choice |
|---|---|
| Runtime | Node.js 20+ |
| Language | TypeScript |
| Bot framework | Telegraf v4 |
| Database | SQLite via `better-sqlite3` |
| Scheduler | `node-cron` |
| Language (UI) | Ukrainian |

---

## Project Structure

```
src/
  bot/
    handlers/        # Telegraf callback_query handlers (button presses)
    keyboards/       # Inline keyboard builders
    middleware/      # Family context injection, role checks
  db/
    schema.ts        # CREATE TABLE statements, run-once migrations
    families.ts      # Family & member queries
    rules.ts         # work_rules + fixed_assignments queries
    duties.ts        # Duty assignment queries (who is on duty today)
    completions.ts   # Duty status update queries
  scheduler/
    index.ts         # node-cron job setup (8am / 2pm / 6pm)
    reminders.ts     # Logic: which duties are still pending?
  domain/
    rotation.ts      # Round-robin rotation logic
    schedule.ts      # Day-of-week schedule resolution
    assignment.ts    # Duty row generation per rule type
  index.ts           # Entry point: bot + scheduler startup
```

Each layer has one responsibility. `domain/` is pure logic with no Telegram or DB dependencies. `db/` is pure data access. `bot/` is pure Telegram surface.

---

## Data Model

### `families`
One row per Telegram group.

```
id          INTEGER PRIMARY KEY
chat_id     INTEGER UNIQUE        -- Telegram group chat_id (family key)
name        TEXT                  -- auto-populated from group name
created_at  INTEGER
```

### `members`
One row per family member.

```
id            INTEGER PRIMARY KEY
family_id     INTEGER → families.id
telegram_id   INTEGER              -- Telegram user_id (set on registration)
name          TEXT                 -- display name, set by dad
role          TEXT                 -- 'dad' | 'mom' | 'kid'
kid_order     INTEGER NULL         -- 1–N, used for round-robin ordering (kids only)
active        INTEGER DEFAULT 1
```

### `work_rules`
One row per chore type per family. Defines schedule, worker count, and rotation mode.

```
id             INTEGER PRIMARY KEY
family_id      INTEGER → families.id
name           TEXT           -- display name, e.g. 'Посудомийна машина'
schedule       TEXT           -- comma-separated days: 'mon,tue,wed,thu,fri,sat,sun' | 'tue,thu' | 'sat'
workers_count  INTEGER        -- how many kids per shift
rotation_mode  TEXT           -- 'round_robin' | 'fixed' | 'all'
active         INTEGER DEFAULT 1
```

### `fixed_assignments`
Defines which kids are permanently assigned to a `fixed` rotation rule.

```
id          INTEGER PRIMARY KEY
rule_id     INTEGER → work_rules.id
member_id   INTEGER → members.id
```

### `rotation_state`
Tracks the current round-robin position per rule.

```
rule_id        INTEGER UNIQUE → work_rules.id
current_pos    INTEGER DEFAULT 0   -- index into ordered kids list
last_advanced  TEXT                -- YYYY-MM-DD of last advance
```

### `duties`
One row per person per duty occurrence. Created by the scheduler at midnight for the coming day.

```
id             INTEGER PRIMARY KEY
family_id      INTEGER → families.id
rule_id        INTEGER → work_rules.id
member_id      INTEGER → members.id   -- the assigned duty person
duty_date      TEXT                   -- YYYY-MM-DD
status         TEXT                   -- 'pending' | 'approval_pending' | 'done' | 'rejected'
requested_by   INTEGER NULL           -- member_id of non-duty person requesting approval
approved_by    INTEGER NULL           -- member_id of parent who approved/rejected
done_at        INTEGER NULL           -- unix timestamp
created_at     INTEGER
```

**Status transitions:**
- `pending` → `done` (duty person, dad, or mom marks done directly)
- `pending` → `approval_pending` (non-duty person presses ✅, awaiting parent response)
- `approval_pending` → `done` (parent approves; `approved_by` set)
- `approval_pending` → `pending` (parent rejects; `requested_by` cleared)

---

## Rotation Logic

### `round_robin`
- Kids are ordered by `kid_order` (1–N).
- `rotation_state.current_pos` points to the next kid in line.
- On each duty date, `workers_count` consecutive kids (wrapping) are assigned.
- After assignment, `current_pos` advances by `workers_count`.
- Advance only happens once per date (guarded by `last_advanced`).

### `fixed`
- Assigned kids come directly from `fixed_assignments` for that rule.
- `rotation_state` is not used.
- `workers_count` must equal the number of rows in `fixed_assignments` for that rule.

### `all`
- All active kids are assigned.
- `rotation_state` is not used.

---

## Scheduler Jobs

Three `node-cron` jobs run daily, using the server's local timezone:

| Time | Action |
|---|---|
| 00:01 | Generate `duties` rows for today's date (for all active rules whose schedule matches today's day-of-week) |
| 08:00 | Post daily summary to each family group, pin the message |
| 14:00 | Post reminder for still-pending duties (skip if all done) |
| 18:00 | Post final reminder for still-pending duties (skip if all done) |

The 8am summary message is **pinned** immediately after posting. The bot requires admin rights with "Pin Messages" and "Edit Messages" permissions.

When a duty is marked done, the bot **edits the pinned message in-place** — no new message noise. When all duties are done, the bot edits the message to show all complete and unpins it.

---

## Bot Interaction Flows

### Family Registration

1. Bot is added to a group → detects first use → posts "Налаштувати сім'ю" button (visible to all, but only the first person to press it becomes dad).
2. Dad adds family members one by one: assigns name + role (dad / mom / kid) + kid order.
3. Bot posts a "Link your account" message listing all unlinked member names as buttons. Each person presses their own name to associate their Telegram identity.
4. Bot confirms each link with a short group message.

### Admin: Add Chore Type (Wizard)

Step-by-step button flow, initiated from the admin menu:

```
1. Pick days → toggle buttons (Mon/Tue/Wed/Thu/Fri/Sat/Sun), then [Підтвердити]
2. How many workers? → (1 / 2 / 3 / 4)
3. Same settings for all selected days? → (Так / Розділити)
   → if Розділити: repeat steps 2–5 per subset of days
4. Rotation type → (По черзі / Фіксовані / Всі)
   → if Фіксовані: pick kids from list (multi-select)
5. Confirm → rule + fixed_assignments saved
```

Each branch through the wizard creates one `work_rules` row.

### Daily Group Summary (8am)

```
📋 Чергування на сьогодні, 30 травня:

🍽 Посудомийна машина — Олег     [✅ Виконано]
🧹 Прибирання (легке) — Аня      [✅ Виконано]
                       — Іра      [✅ Виконано]
```

The message is pinned. Each `[✅ Виконано]` button is tied to a specific `duties` row.

### Marking Done

- **Duty person, dad, or mom** presses ✅ → `duties.status = 'done'`, pinned message updates inline.
- **Any other person** presses ✅ → bot posts an approval request in the group:
  ```
  ⚠️ Іра хоче відмітити завдання Олега як виконане.
  [✅ Схвалити]  [❌ Відхилити]
  ```
  Both dad and mom see the approval buttons. First to respond wins. `duties.approved_by` records who acted.

### Reminders (2pm / 6pm)

Posted to the group as a new message (not pinned) listing only still-pending duties:

```
⏰ Нагадування — ще не виконано:
🍽 Посудомийна машина — Олег
[✅ Виконано]
```

---

## Role Permissions Summary

| Action | Kid (on duty) | Kid (not on duty) | Mom | Dad |
|---|---|---|---|---|
| Mark own duty done | ✅ | — | — | — |
| Mark other's duty done | ❌ requires approval | ❌ requires approval | ✅ | ✅ |
| Approve non-duty completion | ❌ | ❌ | ✅ | ✅ |
| Add/edit chore rules | ❌ | ❌ | ✅ | ✅ |
| Add/edit members | ❌ | ❌ | ❌ | ✅ |

---

## Multi-Family Isolation

Every DB query is scoped by `family_id` (= Telegram `chat_id`). No cross-family data access is possible. One bot process, many independent families.

---

## Out of Scope (this spec)

- Push notifications to private DMs
- Shopping list / card sharing feature
- Web dashboard
- Vacation / skip-day scheduling
