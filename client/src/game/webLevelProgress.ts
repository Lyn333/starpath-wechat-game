import type { ForestLevel, LevelDifficulty } from "./levelBundle";

export type CompletionMap = Record<string, number>;

export function getLevelGroup(levels: ForestLevel[], gridSize: ForestLevel["gridSize"], difficulty: LevelDifficulty) {
  return levels.filter((level) => level.gridSize === gridSize && level.difficulty === difficulty);
}

export function isLevelUnlocked(group: ForestLevel[], levelId: string, completed: CompletionMap) {
  const index = group.findIndex((level) => level.id === levelId);
  return index === 0 || (index > 0 && Boolean(completed[group[index - 1]?.id]));
}

export function getNextLevel(group: ForestLevel[], currentId: string, completed: CompletionMap) {
  const index = group.findIndex((level) => level.id === currentId);
  const candidate = group[index + 1];
  return candidate && isLevelUnlocked(group, candidate.id, completed) ? candidate : null;
}

export function getCompletionAction(group: ForestLevel[], currentId: string, completed: CompletionMap) {
  const nextLevel = getNextLevel(group, currentId, completed);
  return nextLevel ? { kind: "next" as const, level: nextLevel } : { kind: "library" as const };
}

export function loadWebProgress(storage: Storage, key: string): CompletionMap {
  try {
    const parsed = JSON.parse(storage.getItem(key) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function persistWebProgress(storage: Storage, key: string, completed: CompletionMap) {
  storage.setItem(key, JSON.stringify(completed));
}
