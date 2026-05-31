import { sqliteTable, integer, text, primaryKey } from 'drizzle-orm/sqlite-core';

export const families = sqliteTable('families', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  chat_id: integer('chat_id').notNull().unique(),
  name: text('name').notNull(),
  created_at: integer('created_at').notNull(),
});

export const members = sqliteTable('members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  family_id: integer('family_id').notNull().references(() => families.id),
  telegram_id: integer('telegram_id'),
  name: text('name').notNull(),
  role: text('role', { enum: ['dad', 'mom', 'kid'] }).notNull(),
  kid_order: integer('kid_order'),
  active: integer('active').notNull().default(1),
});

export const workRules = sqliteTable('work_rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  family_id: integer('family_id').notNull().references(() => families.id),
  name: text('name').notNull(),
  schedule: text('schedule').notNull(),
  workers_count: integer('workers_count').notNull(),
  rotation_mode: text('rotation_mode', { enum: ['round_robin', 'fixed', 'all'] }).notNull(),
  active: integer('active').notNull().default(1),
});

export const fixedAssignments = sqliteTable('fixed_assignments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  rule_id: integer('rule_id').notNull().references(() => workRules.id),
  member_id: integer('member_id').notNull().references(() => members.id),
});

export const rotationState = sqliteTable('rotation_state', {
  rule_id: integer('rule_id').notNull().unique().references(() => workRules.id),
  current_pos: integer('current_pos').notNull().default(0),
  last_advanced: text('last_advanced'),
});

export const duties = sqliteTable('duties', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  family_id: integer('family_id').notNull().references(() => families.id),
  rule_id: integer('rule_id').notNull().references(() => workRules.id),
  member_id: integer('member_id').notNull().references(() => members.id),
  duty_date: text('duty_date').notNull(),
  status: text('status', { enum: ['pending', 'approval_pending', 'done', 'rejected'] }).notNull().default('pending'),
  requested_by: integer('requested_by').references(() => members.id),
  approved_by: integer('approved_by').references(() => members.id),
  done_at: integer('done_at'),
  created_at: integer('created_at').notNull(),
});

export const dailySummaries = sqliteTable('daily_summaries', {
  family_id: integer('family_id').notNull().references(() => families.id),
  duty_date: text('duty_date').notNull(),
  message_id: integer('message_id').notNull(),
}, t => ({
  pk: primaryKey({ columns: [t.family_id, t.duty_date] }),
}));
