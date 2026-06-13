import type { RotationMode } from "../../types.js";

export const WizardStep = {
  Name: "name",
  Days: "days",
  Workers: "workers",
  Split: "split",
  SubsetDays: "subset_days",
  Rotation: "rotation",
  FixedMembers: "fixed_members",
  Confirm: "confirm",
} as const;
export type WizardStep = (typeof WizardStep)[keyof typeof WizardStep];

export interface WizardState {
  step: WizardStep;
  ruleName: string;
  selectedDays: string[];
  workersCount: number;
  rotationMode: RotationMode | null;
  fixedMembers: number[];
  completedSubsets: Array<{
    days: string[];
    workersCount: number;
    rotationMode: RotationMode;
    fixedMembers: number[];
  }>;
  remainingDays: string[];
  currentSubsetDays: string[];
}

const states = new Map<number, WizardState>();

export function initWizard(chatId: number): void {
  states.set(chatId, {
    step: WizardStep.Name,
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
