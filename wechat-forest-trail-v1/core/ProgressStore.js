const STORAGE_KEY = "forest-trail-wechat-v1-progress-v1";
function platform() { return typeof wx === "undefined" ? null : wx; }

class ProgressStore {
  constructor() { this.state = this.load(); this.state.completed ||= {}; this.state.best ||= {}; this.state.daily ||= {}; this.state.continuations ||= {}; this.state.clock ||= { best: {}, ordinals: {} }; this.state.clock.best ||= {}; this.state.clock.ordinals ||= {}; this.state.streak ||= { count: 0, lastDate: null }; }
  load() {
    try { const value = platform()?.getStorageSync(STORAGE_KEY); if (value?.version === 1) return value; } catch (_) { /* storage is optional */ }
    return { version: 1, completed: {}, best: {}, daily: {}, continuations: {}, clock: { best: {}, ordinals: {} }, soundEnabled: true, streak: { count: 0, lastDate: null } };
  }
  save() { try { platform()?.setStorageSync(STORAGE_KEY, this.state); } catch (_) { /* keep play available */ } }
  isCompleted(id) { return Boolean(this.state.completed[id]); }
  markComplete(level, result) {
    const score = { moves: result.moves, elapsedMs: result.elapsedMs, completedAt: Date.now() };
    const best = this.state.best[level.id];
    if (!best || score.moves < best.moves || score.moves === best.moves && score.elapsedMs < best.elapsedMs) this.state.best[level.id] = score;
    this.state.completed[level.id] = { completedAt: score.completedAt };
    if (level.sourceKind === "daily") this.state.daily[level.challengeDate] = { challengeId: level.id, completedAt: score.completedAt };
    const today = new Date(score.completedAt).toISOString().slice(0, 10); if (this.state.streak.lastDate !== today) { const previous = new Date(score.completedAt - 86400000).toISOString().slice(0, 10); this.state.streak.count = this.state.streak.lastDate === previous ? this.state.streak.count + 1 : 1; this.state.streak.lastDate = today; }
    this.save(); return this.getCompletionSummary(level, score);
  }
  getCompletionSummary(level, current) { const best = this.state.best[level.id]; return { current: current || best || { moves: 0, elapsedMs: 0 }, best: best || current || { moves: 0, elapsedMs: 0 }, streak: this.state.streak.count || 0, completedCount: Object.keys(this.state.completed).length }; }
  isDailyComplete(level) { return this.state.daily[level.challengeDate]?.challengeId === level.id; }
  nextContinuation(gridSize, difficulty) { const key = `${gridSize}:${difficulty}`; const ordinal = (this.state.continuations[key] || 0) + 1; this.state.continuations[key] = ordinal; this.save(); return ordinal; }
  nextClock(tierId) { const ordinal = (this.state.clock.ordinals[tierId] || 0) + 1; this.state.clock.ordinals[tierId] = ordinal; this.save(); return ordinal; }
  recordClockResult(tierId, result) {
    const current = { solved: Math.max(0, Math.floor(result.solved || 0)), remainingMs: Math.max(0, Math.floor(result.remainingMs || 0)), endedAt: Date.now() };
    const best = this.state.clock.best[tierId];
    if (!best || current.solved > best.solved || current.solved === best.solved && current.remainingMs > best.remainingMs) this.state.clock.best[tierId] = current;
    this.save(); return { current, best: this.state.clock.best[tierId] };
  }
  clockBest(tierId) { return this.state.clock.best[tierId] || { solved: 0, remainingMs: 0 }; }
  setSoundEnabled(enabled) { this.state.soundEnabled = Boolean(enabled); this.save(); }
  soundEnabled() { return this.state.soundEnabled !== false; }
}

module.exports = { ProgressStore };
