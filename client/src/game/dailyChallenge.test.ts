import { describe, expect, it } from "vitest";
import { createDailyChallenge, dailyChallengeDate, isDailyChallengeCompleted, isValidDailyChallenge, loadDailyChallengeProgress, markDailyChallengeCompleted, persistDailyChallengeProgress } from "./dailyChallenge";

describe("daily challenge", () => {
  it("uses the same China Standard Time day for every player and changes after midnight", () => {
    expect(dailyChallengeDate(new Date("2026-08-17T15:59:59.000Z"))).toBe("2026-08-17");
    expect(dailyChallengeDate(new Date("2026-08-17T16:00:00.000Z"))).toBe("2026-08-18");
  });

  it("creates one stable valid 8x8 hard challenge for a given day", () => {
    const first = createDailyChallenge(new Date("2026-08-18T01:00:00.000Z"));
    const repeated = createDailyChallenge(new Date("2026-08-18T15:00:00.000Z"));
    const tomorrow = createDailyChallenge(new Date("2026-08-19T01:00:00.000Z"));

    expect(first.id).toBe(repeated.id);
    expect(first.solution).toEqual(repeated.solution);
    expect(first.id).not.toBe(tomorrow.id);
    expect(first.challengeDate).toBe("2026-08-18");
    expect(isValidDailyChallenge(first)).toBe(true);
  });

  it("persists completion by daily date and challenge id", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    const challenge = createDailyChallenge(new Date("2026-08-18T01:00:00.000Z"));
    const progress = markDailyChallengeCompleted({}, challenge, 1_786_999_200_000);

    persistDailyChallengeProgress(storage, progress);
    expect(isDailyChallengeCompleted(loadDailyChallengeProgress(storage), challenge)).toBe(true);
    expect(isDailyChallengeCompleted(progress, createDailyChallenge(new Date("2026-08-19T01:00:00.000Z")))).toBe(false);
  });
});
