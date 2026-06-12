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
  role: "dad" | "mom" | "kid";
  gender: "male" | "female";
  kid_order: number | null;
  active: number;
}

export interface WorkRule {
  id: number;
  group_id: number;
  name: string;
  schedule: string;
  workers_count: number;
  rotation_mode: "round_robin" | "fixed" | "all";
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
  status: "pending" | "approval_pending" | "done" | "rejected";
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
