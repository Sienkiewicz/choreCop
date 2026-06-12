import type { Context } from "telegraf";
import type { Group, Member } from "../types.js";

export interface BotContext extends Context {
  group: Group | null;
  member: Member | null;
}
