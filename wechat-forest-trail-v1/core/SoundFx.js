const BACKGROUND_MUSIC_SOURCE = "audio/forest-trail-background.mp3";
const COMPLETION_CELEBRATION_SOURCE = "audio/completion-celebration-drum.mp3";

const BACKGROUND_MUSIC_VOLUME = .7098;
const COMPLETION_CELEBRATION_VOLUME = .9999;

class SoundFx {
  constructor(enabled = true) { this.enabled = Boolean(enabled); this.context = null; this.backgroundMusic = null; this.completionCelebration = null; }
  setEnabled(enabled) { this.enabled = Boolean(enabled); if (this.enabled) this.startBackgroundMusic(); else { this.backgroundMusic?.stop?.(); this.completionCelebration?.stop?.(); } }
  ensureBackgroundMusic() {
    if (!this.enabled || typeof wx === "undefined" || !wx.createInnerAudioContext) return null;
    try {
      if (!this.backgroundMusic) {
        this.backgroundMusic = wx.createInnerAudioContext(); this.backgroundMusic.src = BACKGROUND_MUSIC_SOURCE; this.backgroundMusic.autoplay = false; this.backgroundMusic.loop = true; this.backgroundMusic.volume = BACKGROUND_MUSIC_VOLUME; this.backgroundMusic.obeyMuteSwitch = false;
      }
      return this.backgroundMusic;
    } catch (_) { return null; }
  }
  startBackgroundMusic() { const audio = this.ensureBackgroundMusic(); if (!audio) return false; try { audio.play?.(); return true; } catch (_) { return false; } }
  ensureCompletionCelebration() {
    if (!this.enabled || typeof wx === "undefined" || !wx.createInnerAudioContext) return null;
    try {
      if (!this.completionCelebration) {
        this.completionCelebration = wx.createInnerAudioContext(); this.completionCelebration.src = COMPLETION_CELEBRATION_SOURCE; this.completionCelebration.autoplay = false; this.completionCelebration.loop = false; this.completionCelebration.volume = COMPLETION_CELEBRATION_VOLUME; this.completionCelebration.obeyMuteSwitch = false;
      }
      return this.completionCelebration;
    } catch (_) { return null; }
  }
  playCompletionCelebration() { const audio = this.ensureCompletionCelebration(); if (!audio) return false; try { audio.stop?.(); audio.seek?.(0); audio.play?.(); return true; } catch (_) { return false; } }
  ensureContext() {
    if (!this.enabled || typeof wx === "undefined" || !wx.createWebAudioContext) return null;
    try { this.context ||= wx.createWebAudioContext(); this.context.resume?.(); return this.context; } catch (_) { return null; }
  }
  tone(frequency, at = 0, duration = .12, gain = .045, type = "sine") {
    const context = this.ensureContext(); if (!context?.createOscillator) return;
    try {
      const oscillator = context.createOscillator(); const envelope = context.createGain(); const now = context.currentTime + at;
      oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, now); envelope.gain.setValueAtTime(.0001, now); envelope.gain.exponentialRampToValueAtTime(gain, now + .012); envelope.gain.exponentialRampToValueAtTime(.0001, now + duration);
      oscillator.connect(envelope); envelope.connect(context.destination); oscillator.start(now); oscillator.stop(now + duration + .02);
    } catch (_) { /* audio is best-effort */ }
  }
  tap() { /* 按键保持静音。 */ }
  step() { /* 普通连线保持静音。 */ }
  coin() { [[1046.5, 0, .11, .228], [1318.5, .09, .13, .204], [1568, .19, .17, .18]].forEach(([frequency, at, duration, gain]) => this.tone(frequency, at, duration, gain, "sine")); }
  undo() { /* 撤回保持静音。 */ }
  reset() { /* 清空保持静音。 */ }
  complete() { [[523.25, 0, .12, .0825], [659.25, .1, .14, .09], [783.99, .2, .16, .0975], [1046.5, .32, .3, .1125]].forEach(([frequency, at, duration, gain]) => this.tone(frequency, at, duration, gain, "triangle")); }
  destroy() { try { this.backgroundMusic?.destroy?.(); this.completionCelebration?.destroy?.(); } catch (_) { /* audio is best-effort */ } this.backgroundMusic = null; this.completionCelebration = null; this.context = null; }
}

module.exports = { SoundFx, BACKGROUND_MUSIC_VOLUME, COMPLETION_CELEBRATION_VOLUME };
