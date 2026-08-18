import { createSeededPuzzle, validateSeededPuzzle, type SeededForestLevel } from "./seededPuzzle";
import type { ForestLevel } from "./levelBundle";

export const DAILY_CHALLENGE_PROGRESS_KEY = "forest-trail-daily-challenge-progress-v1";
export const DAILY_CHALLENGE_TIME_ZONE = "Asia/Shanghai";

export interface DailyChallenge extends ForestLevel {
  challengeDate: string;
  challengeKind: "daily";
}

export type DailyChallengeProgress = Record<string, { challengeId: string; completedAt: number }>;

export function dailyChallengeDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DAILY_CHALLENGE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dailyOrdinal(challengeDate: string): number {
  return Math.floor(Date.parse(`${challengeDate}T00:00:00Z`) / 86_400_000);
}

export function createDailyChallenge(date = new Date()): DailyChallenge {
  const challengeDate = dailyChallengeDate(date);
  const generated = createSeededPuzzle({
    gridSize: "8x8",
    difficulty: "hard",
    seed: `forest-trail:daily:v1:${DAILY_CHALLENGE_TIME_ZONE}:${challengeDate}`,
    ordinal: dailyOrdinal(challengeDate),
  });

  return {
    ...generated,
    id: `daily-${challengeDate}-${generated.fingerprint}`,
    name: `每日挑战 · ${challengeDate}`,
    challengeDate,
    challengeKind: "daily",
  };
}

export function loadDailyChallengeProgress(storage: Pick<Storage, "getItem">): DailyChallengeProgress {
  try {
    const raw = storage.getItem(DAILY_CHALLENGE_PROGRESS_KEY);
    return raw ? JSON.parse(raw) as DailyChallengeProgress : {};
  } catch {
    return {};
  }
}

export function persistDailyChallengeProgress(storage: Pick<Storage, "setItem">, progress: DailyChallengeProgress): void {
  storage.setItem(DAILY_CHALLENGE_PROGRESS_KEY, JSON.stringify(progress));
}

export function markDailyChallengeCompleted(progress: DailyChallengeProgress, challenge: DailyChallenge, completedAt = Date.now()): DailyChallengeProgress {
  return { ...progress, [challenge.challengeDate]: { challengeId: challenge.id, completedAt } };
}

export function isDailyChallengeCompleted(progress: DailyChallengeProgress, challenge: DailyChallenge): boolean {
  return progress[challenge.challengeDate]?.challengeId === challenge.id;
}

export function isValidDailyChallenge(challenge: DailyChallenge): boolean {
  return challenge.challengeKind === "daily" && challenge.gridSize === "8x8" && challenge.difficulty === "hard" && typeof challenge.seed === "string" && typeof challenge.fingerprint === "string" && validateSeededPuzzle(challenge as SeededForestLevel);
}
