import { describe, expect, it } from "vitest";
import { SOUND_PREFERENCE_KEY, SOUND_TONES, loadSoundEnabled, persistSoundEnabled, playUiSound } from "./soundEffects";

describe("sound preferences", () => {
  it("enables sound by default and persists explicit user choices", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    expect(loadSoundEnabled(storage)).toBe(true);
    persistSoundEnabled(false, storage);
    expect(values.get(SOUND_PREFERENCE_KEY)).toBe("0");
    expect(loadSoundEnabled(storage)).toBe(false);
    persistSoundEnabled(true, storage);
    expect(values.get(SOUND_PREFERENCE_KEY)).toBe("1");
  });

  it("silently degrades when Web Audio is unavailable", () => {
    expect(() => playUiSound("complete", true)).not.toThrow();
    expect(() => playUiSound("tap", false)).not.toThrow();
  });

  it("uses a layered ascending celebration for completed puzzles", () => {
    const celebration = SOUND_TONES.complete;
    const sharedChord = celebration.filter((tone) => tone.delay === 0.33);

    expect(celebration).toHaveLength(11);
    expect(celebration.map((tone) => tone.frequency)).toEqual(expect.arrayContaining([261.63, 523.25, 659.25, 783.99, 1046.5, 2093]));
    expect(sharedChord).toHaveLength(3);
    expect(Math.max(...celebration.map((tone) => tone.delay + tone.duration))).toBeGreaterThanOrEqual(0.7);
  });
});
