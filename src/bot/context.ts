import type { Context } from "telegraf";
import type { Group, Member } from "@src/types";

export interface BotContext extends Context {
  group: Group | null;
  member: Member | null;
}
