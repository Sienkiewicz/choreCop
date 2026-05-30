const DAY_NAMES: Record<number, string> = {
  0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
};

export function matchesDate(schedule: string, date: Date): boolean {
  const norm = schedule.toLowerCase().trim();
  if (norm === 'daily') return true;
  const dayName = DAY_NAMES[date.getDay()];
  return norm.split(',').map(d => d.trim()).includes(dayName);
}
