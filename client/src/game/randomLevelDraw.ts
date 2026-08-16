import type { ForestGridSize, ForestLevel, LevelDifficulty } from "./levelBundle";
import type { CompletionMap } from "./webLevelProgress";

function groupKey(level: ForestLevel): string {
  return `${level.gridSize}:${level.difficulty}`;
}

export function shuffleLaunchCatalog(levels: ForestLevel[], random: () => number = Math.random): ForestLevel[] {
  const groups = new Map<string, ForestLevel[]>();
  for (const level of levels) {
    const key = groupKey(level);
    groups.set(key, [...(groups.get(key) ?? []), level]);
  }
  return Array.from(groups.values()).flatMap((group) => {
    const shuffled = [...group];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      [shuffled[index], shuffled[target]] = [shuffled[target]!, shuffled[index]!];
    }
    return shuffled;
  });
}

export function drawRandomLevel(input: {
  levels: ForestLevel[];
  completed: CompletionMap;
  gridSize: ForestGridSize;
  difficulty: LevelDifficulty;
  excludeId?: string;
  random?: () => number;
}): ForestLevel | null {
  const candidates = input.levels.filter((level) => (
    level.gridSize === input.gridSize
    && level.difficulty === input.difficulty
    && level.id !== input.excludeId
    && !input.completed[level.id]
  ));
  if (candidates.length === 0) return null;
  return candidates[Math.floor((input.random ?? Math.random)() * candidates.length)] ?? null;
}
