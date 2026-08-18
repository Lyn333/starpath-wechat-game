class SoundFx {
  constructor(enabled = true) { this.enabled = enabled; this.context = null; }
  setEnabled(enabled) { this.enabled = Boolean(enabled); }
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
  tap() { this.tone(660, 0, .05, .05, "square"); }
  step() { this.tone(420, 0, .045, .035, "sine"); }
  undo() { this.tone(310, 0, .06, .04, "triangle"); }
  reset() { this.tone(240, 0, .08, .05, "triangle"); }
  complete() { [[392, 0, .1], [494, .09, .12], [587, .18, .14], [784, .27, .19], [659, .27, .19], [988, .42, .24]].forEach(([frequency, at, duration]) => this.tone(frequency, at, duration, .07, "sine")); }
}

module.exports = { SoundFx };
