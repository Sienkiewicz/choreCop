export function getNextPositions(currentPos: number, kidCount: number, workersCount: number): number[] {
  const positions: number[] = [];
  for (let i = 0; i < workersCount; i++) {
    positions.push((currentPos + i) % kidCount);
  }
  return positions;
}

export function advancePosition(currentPos: number, kidCount: number, workersCount: number): number {
  return (currentPos + workersCount) % kidCount;
}
