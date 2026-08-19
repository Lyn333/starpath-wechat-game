const USER_DRUM_SOURCE = "assets/forest-trail-user-drum.mp3";

class SoundFx {
  constructor(enabled = true) { this.enabled = enabled; this.context = null; this.userDrum = null; }
  setEnabled(enabled) { this.enabled = Boolean(enabled); }
  ensureUserDrum() {
    if (!this.enabled || typeof wx === "undefined" || !wx.createInnerAudioContext) return null;
    try {
      if (!this.userDrum) { this.userDrum = wx.createInnerAudioContext(); this.userDrum.src = USER_DRUM_SOURCE; this.userDrum.autoplay = false; this.userDrum.obeyMuteSwitch = false; }
      return this.userDrum;
    } catch (_) { return null; }
  }
  playUserDrum() {
    const audio = this.ensureUserDrum(); if (!audio) return false;
    try { audio.stop?.(); audio.seek?.(0); audio.play?.(); return true; } catch (_) { return false; }
  }
  ensureContext() {
    if (!this.enabled || typeof wx === "undefined" || !wx.createWebAudioContext) return null;
    try { this.context ||= wx.createWebAudioContext(); this.context.resume?.(); return this.context; } catch (_) { return null; }
  }
  tone(frequency, at = 0, duration = .08, gain = .08, type = "sine") {
    const context = this.ensureContext(); if (!context?.createOscillator) return;
    try {
      const oscillator = context.createOscillator(); const envelope = context.createGain();
      oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, context.currentTime + at);
      envelope.gain.setValueAtTime(.0001, context.currentTime + at);
      envelope.gain.exponentialRampToValueAtTime(gain, context.currentTime + at + .012);
      envelope.gain.exponentialRampToValueAtTime(.0001, context.currentTime + at + duration);
      oscillator.connect(envelope); envelope.connect(context.destination); oscillator.start(context.currentTime + at); oscillator.stop(context.currentTime + at + duration + .02);
    } catch (_) { /* audio is best-effort */ }
  }
  taiko(at = 0, intensity = 1, rim = false) {
    const context = this.ensureContext(); if (!context?.createOscillator) return;
    try {
      const now = context.currentTime + at; const drum = context.createOscillator(); const body = context.createGain();
      const start = rim ? 380 : 155 + intensity * 28; const end = rim ? 170 : 54;
      drum.type = rim ? "square" : "sine"; drum.frequency.setValueAtTime(start, now); drum.frequency.exponentialRampToValueAtTime(end, now + (rim ? .035 : .12));
      body.gain.setValueAtTime(.0001, now); body.gain.exponentialRampToValueAtTime((rim ? .035 : .095) * intensity, now + .006); body.gain.exponentialRampToValueAtTime(.0001, now + (rim ? .045 : .15));
      drum.connect(body); body.connect(context.destination); drum.start(now); drum.stop(now + .18);
      if (!rim) this.tone(820, at, .022, .018 * intensity, "square");
    } catch (_) { /* audio is best-effort */ }
  }
  tap() { /* 按键不播放音效：鼓声仅用于路标数字触达。 */ }
  step() { /* 普通连线保持静音；路标触达由 coin() 单独反馈。 */ }
  coin() { this.playUserDrum(); }
  undo() { /* 撤回不播放音效。 */ }
  reset() { /* 清空不播放音效。 */ }
  complete() { /* 通关由最后一个路标的 coin() 反馈，不重复播放。 */ }
  destroy() { try { this.userDrum?.destroy?.(); } catch (_) { /* audio is best-effort */ } this.userDrum = null; }
}

module.exports = { SoundFx };
