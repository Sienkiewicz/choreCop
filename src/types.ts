export const Role = {
  Dad: "dad",
  Mom: "mom",
  Kid: "kid",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const Gender = {
  Male: "male",
  Female: "female",
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

export const RotationMode = {
  RoundRobin: "round_robin",
  Fixed: "fixed",
  All: "all",
} as const;
export type RotationMode = (typeof RotationMode)[keyof typeof RotationMode];

export const DutyStatus = {
  Pending: "pending",
  ApprovalPending: "approval_pending",
  Done: "done",
  Rejected: "rejected",
} as const;
export type DutyStatus = (typeof DutyStatus)[keyof typeof DutyStatus];

export interface Group {
  id: number;
  chat_id: number;
  name: string;
  created_at: number;
}

export interface Member {
  id: number;
  group_id: number;
  telegram_id: number | null;
  username: string | null;
  name: string;
  role: Role;
  gender: Gender;
  kid_order: number | null;
  active: number;
}

export interface WorkRule {
  id: number;
  group_id: number;
  name: string;
  schedule: string;
  workers_count: number;
  rotation_mode: RotationMode;
  active: number;
}

export interface FixedAssignment {
  id: number;
  rule_id: number;
  member_id: number;
}

export interface RotationState {
  rule_id: number;
  current_pos: number;
  last_advanced: string | null;
}

export interface Duty {
  id: number;
  group_id: number;
  rule_id: number;
  member_id: number;
  duty_date: string;
  status: DutyStatus;
  requested_by: number | null;
  approved_by: number | null;
  done_by: number | null;
  done_at: number | null;
  created_at: number;
}

export interface DailySummary {
  group_id: number;
  duty_date: string;
  message_id: number;
}

export interface BotMessage {
  id: number;
  group_id: number;
  chat_id: number;
  message_id: number;
  created_at: number;
}
