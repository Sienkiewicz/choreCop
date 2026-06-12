export type WizardStep =
  | "name"
  | "days"
  | "workers"
  | "split"
  | "subset_days"
  | "rotation"
  | "fixed_members"
  | "confirm";

export interface WizardState {
  step: WizardStep;
  ruleName: string;
  selectedDays: string[];
  workersCount: number;
  rotationMode: "round_robin" | "fixed" | "all" | null;
  fixedMembers: number[];
  completedSubsets: Array<{
    days: string[];
    workersCount: number;
    rotationMode: "round_robin" | "fixed" | "all";
    fixedMembers: number[];
  }>;
  remainingDays: string[];
  currentSubsetDays: string[];
}

const states = new Map<number, WizardState>();

export function initWizard(chatId: number): void {
  states.set(chatId, {
    step: "name",
    ruleName: "",
    selectedDays: [],
    workersCount: 1,
    rotationMode: null,
    fixedMembers: [],
    completedSubsets: [],
    remainingDays: [],
    currentSubsetDays: [],
  });
}

export function getWizard(chatId: number): WizardState | null {
  return states.get(chatId) ?? null;
}

export function updateWizard(
  chatId: number,
  patch: Partial<WizardState>,
): void {
  const state = states.get(chatId);
  if (state) states.set(chatId, { ...state, ...patch });
}

export function clearWizard(chatId: number): void {
  states.delete(chatId);
}
