const BACKGROUND_MUSIC_SOURCE = "audio/forest-trail-background.mp3";

class SoundFx {
  constructor(enabled = true) { this.enabled = Boolean(enabled); this.context = null; this.backgroundMusic = null; }
  setEnabled(enabled) { this.enabled = Boolean(enabled); if (this.enabled) this.startBackgroundMusic(); else this.backgroundMusic?.stop?.(); }
  ensureBackgroundMusic() {
    if (!this.enabled || typeof wx === "undefined" || !wx.createInnerAudioContext) return null;
    try {
      if (!this.backgroundMusic) {
        this.backgroundMusic = wx.createInnerAudioContext(); this.backgroundMusic.src = BACKGROUND_MUSIC_SOURCE; this.backgroundMusic.autoplay = false; this.backgroundMusic.loop = true; this.backgroundMusic.volume = .28; this.backgroundMusic.obeyMuteSwitch = false;
      }
      return this.backgroundMusic;
    } catch (_) { return null; }
  }
  startBackgroundMusic() { const audio = this.ensureBackgroundMusic(); if (!audio) return false; try { audio.play?.(); return true; } catch (_) { return false; } }
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
  coin() { [[1046.5, 0, .11, .038], [1318.5, .09, .13, .034], [1568, .19, .17, .03]].forEach(([frequency, at, duration, gain]) => this.tone(frequency, at, duration, gain, "sine")); }
  undo() { /* 撤回保持静音。 */ }
  reset() { /* 清空保持静音。 */ }
  complete() { /* 通关由最后一个路标的日历提醒提示反馈，不重复播放。 */ }
  destroy() { try { this.backgroundMusic?.destroy?.(); } catch (_) { /* audio is best-effort */ } this.backgroundMusic = null; this.context = null; }
}

module.exports = { SoundFx };
