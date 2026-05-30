import type { Context } from 'telegraf';
import type { Family, Member } from '../types.js';

export interface BotContext extends Context {
  family: Family | null;
  member: Member | null;
}
