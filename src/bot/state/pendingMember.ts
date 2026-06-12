const pendingNames = new Map<number, string>();

export function setPendingMemberName(chatId: number, name: string): void {
  pendingNames.set(chatId, name);
}

export function getPendingMemberName(chatId: number): string | undefined {
  return pendingNames.get(chatId);
}

export function clearPendingMemberName(chatId: number): void {
  pendingNames.delete(chatId);
}
