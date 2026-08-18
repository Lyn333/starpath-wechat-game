export const SOUND_PREFERENCE_KEY = "forest-trail-sound-enabled-v1";

export type SoundEffect = "tap" | "step" | "undo" | "reset" | "complete";

type Tone = {
  frequency: number;
  delay: number;
  duration: number;
  type: OscillatorType;
  volume: number;
};

export const SOUND_TONES: Record<SoundEffect, Tone[]> = {
  tap: [{ frequency: 620, delay: 0, duration: 0.045, type: "sine", volume: 0.035 }],
  step: [{ frequency: 420, delay: 0, duration: 0.05, type: "triangle", volume: 0.03 }],
  undo: [{ frequency: 300, delay: 0, duration: 0.07, type: "sine", volume: 0.035 }],
  reset: [{ frequency: 250, delay: 0, duration: 0.06, type: "sine", volume: 0.025 }, { frequency: 190, delay: 0.045, duration: 0.08, type: "sine", volume: 0.025 }],
  // 先以低音落点和上行音阶确认完成，再叠加大三和弦与高音闪光收束；总时长约 0.7 秒。
  complete: [
    { frequency: 261.63, delay: 0, duration: 0.085, type: "sine", volume: 0.02 },
    { frequency: 523.25, delay: 0.015, duration: 0.1, type: "triangle", volume: 0.034 },
    { frequency: 659.25, delay: 0.105, duration: 0.12, type: "triangle", volume: 0.037 },
    { frequency: 783.99, delay: 0.205, duration: 0.14, type: "triangle", volume: 0.04 },
    { frequency: 1046.5, delay: 0.315, duration: 0.24, type: "triangle", volume: 0.048 },
    { frequency: 523.25, delay: 0.33, duration: 0.2, type: "sine", volume: 0.015 },
    { frequency: 659.25, delay: 0.33, duration: 0.2, type: "sine", volume: 0.015 },
    { frequency: 783.99, delay: 0.33, duration: 0.2, type: "sine", volume: 0.015 },
    { frequency: 1318.51, delay: 0.425, duration: 0.09, type: "sine", volume: 0.018 },
    { frequency: 1567.98, delay: 0.49, duration: 0.1, type: "sine", volume: 0.02 },
    { frequency: 2093, delay: 0.575, duration: 0.16, type: "sine", volume: 0.026 },
  ],
};

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const contextConstructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!contextConstructor) return null;
  audioContext ??= new contextConstructor();
  return audioContext;
}

export function loadSoundEnabled(storage: Pick<Storage, "getItem"> = window.localStorage): boolean {
  return storage.getItem(SOUND_PREFERENCE_KEY) !== "0";
}

export function persistSoundEnabled(enabled: boolean, storage: Pick<Storage, "setItem"> = window.localStorage): void {
  storage.setItem(SOUND_PREFERENCE_KEY, enabled ? "1" : "0");
}

/**
 * 通过短促的 Web Audio 音色提供反馈，避免额外媒体资源、网络请求或自动播放行为。
 * 浏览器会在首次按钮或触摸手势后允许 AudioContext 输出；不支持 Web Audio 时静默降级。
 */
export function playUiSound(effect: SoundEffect, enabled: boolean): void {
  if (!enabled) return;
  try {
    const context = getAudioContext();
    if (!context) return;
    if (context.state === "suspended") void context.resume();

    for (const tone of SOUND_TONES[effect]) {
      const startAt = context.currentTime + tone.delay;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = tone.type;
      oscillator.frequency.setValueAtTime(tone.frequency, startAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(tone.volume, startAt + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + tone.duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + tone.duration + 0.02);
    }
  } catch {
    // Web Audio 不可用或受浏览器策略限制时，不影响谜题操作。
  }
}
