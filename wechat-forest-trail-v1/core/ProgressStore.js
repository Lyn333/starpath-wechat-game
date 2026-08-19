const STORAGE_KEY = "forest-trail-wechat-v1-progress-v1";
function platform() { return typeof wx === "undefined" ? null : wx; }

class ProgressStore {
  constructor() { this.state = this.load(); }
  load() {
    try { const value = platform()?.getStorageSync(STORAGE_KEY); if (value?.version === 1) return value; } catch (_) { /* storage is optional */ }
    return { version: 1, completed: {}, best: {}, daily: {}, continuations: {}, soundEnabled: true, soundVolume: .7 };
  }
  save() { try { platform()?.setStorageSync(STORAGE_KEY, this.state); } catch (_) { /* keep play available */ } }
  isCompleted(id) { return Boolean(this.state.completed[id]); }
  markComplete(level, result) {
    const score = { moves: result.moves, elapsedMs: result.elapsedMs, completedAt: Date.now() };
    const best = this.state.best[level.id];
    if (!best || score.moves < best.moves || score.moves === best.moves && score.elapsedMs < best.elapsedMs) this.state.best[level.id] = score;
    this.state.completed[level.id] = { completedAt: score.completedAt };
    if (level.sourceKind === "daily") this.state.daily[level.challengeDate] = { challengeId: level.id, completedAt: score.completedAt };
    this.save();
  }
  isDailyComplete(level) { return this.state.daily[level.challengeDate]?.challengeId === level.id; }
  nextContinuation(gridSize, difficulty) { const key = `${gridSize}:${difficulty}`; const ordinal = (this.state.continuations[key] || 0) + 1; this.state.continuations[key] = ordinal; this.save(); return ordinal; }
  setSoundEnabled(enabled) { this.state.soundEnabled = Boolean(enabled); this.save(); }
  soundEnabled() { return this.state.soundEnabled !== false; }
  setSoundVolume(volume) { this.state.soundVolume = Math.max(.35, Math.min(1, Number(volume) || .7)); this.save(); }
  soundVolume() { return [.35, .7, 1].includes(this.state.soundVolume) ? this.state.soundVolume : .7; }
  cycleSoundVolume() { const levels = [.35, .7, 1]; const next = levels[(levels.indexOf(this.soundVolume()) + 1) % levels.length]; this.setSoundVolume(next); return next; }
}

module.exports = { ProgressStore };
