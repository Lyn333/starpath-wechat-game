const BACKGROUND_MUSIC_SOURCE = "audio/forest-trail-background.mp3";
const NUMBER_EFFECT_SOURCE = "audio/forest-trail-number-effect.mp3";

class SoundFx {
  constructor(enabled = true, volume = .7) {
    this.enabled = Boolean(enabled); this.backgroundMusic = null; this.numberEffect = null; this.volume = .7; this.setVolume(volume);
  }
  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (this.enabled) this.startBackgroundMusic(); else { this.backgroundMusic?.stop?.(); this.numberEffect?.stop?.(); }
  }
  setVolume(volume) {
    this.volume = Math.max(.35, Math.min(1, Number(volume) || .7));
    if (this.backgroundMusic) this.backgroundMusic.volume = .28 * this.volume;
    if (this.numberEffect) this.numberEffect.volume = .72 * this.volume;
    return this.volume;
  }
  ensureBackgroundMusic() {
    if (!this.enabled || typeof wx === "undefined" || !wx.createInnerAudioContext) return null;
    try {
      if (!this.backgroundMusic) {
        this.backgroundMusic = wx.createInnerAudioContext(); this.backgroundMusic.src = BACKGROUND_MUSIC_SOURCE; this.backgroundMusic.autoplay = false; this.backgroundMusic.loop = true; this.backgroundMusic.volume = .28 * this.volume; this.backgroundMusic.obeyMuteSwitch = false;
      }
      return this.backgroundMusic;
    } catch (_) { return null; }
  }
  startBackgroundMusic() {
    const audio = this.ensureBackgroundMusic(); if (!audio) return false;
    try { audio.play?.(); return true; } catch (_) { return false; }
  }
  ensureNumberEffect() {
    if (!this.enabled || typeof wx === "undefined" || !wx.createInnerAudioContext) return null;
    try {
      if (!this.numberEffect) {
        this.numberEffect = wx.createInnerAudioContext(); this.numberEffect.src = NUMBER_EFFECT_SOURCE; this.numberEffect.autoplay = false; this.numberEffect.loop = false; this.numberEffect.volume = .72 * this.volume; this.numberEffect.obeyMuteSwitch = false;
      }
      return this.numberEffect;
    } catch (_) { return null; }
  }
  playNumberEffect() {
    const audio = this.ensureNumberEffect(); if (!audio) return false;
    try { audio.stop?.(); audio.seek?.(0); audio.play?.(); return true; } catch (_) { return false; }
  }
  tap() { /* 按键保持静音。 */ }
  step() { /* 普通连线保持静音。 */ }
  coin() { this.playNumberEffect(); }
  undo() { /* 撤回保持静音。 */ }
  reset() { /* 清空保持静音。 */ }
  complete() { /* 通关由最后一个路标的数字音效反馈，不重复播放。 */ }
  destroy() {
    try { this.backgroundMusic?.destroy?.(); this.numberEffect?.destroy?.(); } catch (_) { /* audio is best-effort */ }
    this.backgroundMusic = null; this.numberEffect = null;
  }
}

module.exports = { SoundFx };
