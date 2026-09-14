const assert = require("assert");
const { SoundFx } = require("../core/SoundFx");

const audioContexts = [], oscillators = [], gains = [];
const webAudio = {
  currentTime: 10,
  resume() {},
  createOscillator() { const oscillator = { type: null, frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} }; oscillators.push(oscillator); return oscillator; },
  createGain() { const node = { gain: { values: [], setValueAtTime(value) { this.values.push(value); }, exponentialRampToValueAtTime(value) { this.values.push(value); } }, connect() {} }; gains.push(node); return node; },
};
global.wx = {
  createWebAudioContext: () => webAudio,
  createInnerAudioContext() {
    const context = { calls: [], stop() { this.calls.push("stop"); }, seek(value) { this.calls.push(`seek:${value}`); }, play() { this.calls.push("play"); }, destroy() { this.calls.push("destroy"); } };
    audioContexts.push(context); return context;
  },
};
const sound = new SoundFx(true);
sound.coin();
assert.deepStrictEqual(gains.map((item) => item.gain.values[1]), [0.228, 0.204, 0.18]);
assert.strictEqual(sound.playCompletionCelebration(), true);
const drum = audioContexts[0];
assert.strictEqual(drum.src, "audio/completion-celebration-drum.mp3");
assert.strictEqual(drum.loop, false);
assert.strictEqual(drum.volume, 0.9999);
assert.deepStrictEqual(drum.calls, ["stop", "seek:0", "play"]);
sound.setEnabled(false);
assert.strictEqual(drum.calls.at(-1), "stop");
console.log("PASS sound-fx");
