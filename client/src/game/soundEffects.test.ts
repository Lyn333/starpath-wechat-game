import { describe, expect, it } from "vitest";
import { SOUND_PREFERENCE_KEY, loadSoundEnabled, persistSoundEnabled, playUiSound } from "./soundEffects";

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
});
