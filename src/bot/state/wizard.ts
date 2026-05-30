export type WizardStep = 'days' | 'workers' | 'split' | 'rotation' | 'fixed_members';

export interface WizardState {
  step: WizardStep;
  ruleName: string;
  selectedDays: string[];
  workersCount: number;
  rotationMode: 'round_robin' | 'fixed' | 'all' | null;
  fixedMembers: number[];
  completedSubsets: Array<{
    days: string[];
    workersCount: number;
    rotationMode: 'round_robin' | 'fixed' | 'all';
    fixedMembers: number[];
  }>;
  remainingDays: string[];
}

const states = new Map<number, WizardState>();

export function initWizard(chatId: number, ruleName: string): void {
  states.set(chatId, {
    step: 'days',
    ruleName,
    selectedDays: [],
    workersCount: 1,
    rotationMode: null,
    fixedMembers: [],
    completedSubsets: [],
    remainingDays: [],
  });
}

export function getWizard(chatId: number): WizardState | null {
  return states.get(chatId) ?? null;
}

export function updateWizard(chatId: number, patch: Partial<WizardState>): void {
  const state = states.get(chatId);
  if (state) states.set(chatId, { ...state, ...patch });
}

export function clearWizard(chatId: number): void {
  states.delete(chatId);
}
