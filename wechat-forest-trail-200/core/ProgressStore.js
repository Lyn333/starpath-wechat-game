/** 微信小游戏本地进度：只保存已通关关卡和最佳记录，不保存任何题目答案。 */
const STORAGE_KEY = "forest-trail-200-progress-v1";

function platform() {
  return typeof wx === "undefined" ? null : wx;
}

class ProgressStore {
  constructor() {
    this.state = this.load();
  }

  load() {
    try {
      const value = platform()?.getStorageSync(STORAGE_KEY);
      if (value && typeof value === "object" && value.version === 1) return value;
    } catch (_) {
      // 本地缓存不可用时仍可正常游玩，只是不保存进度。
    }
    return { version: 1, completed: {}, best: {}, lastLevelId: null };
  }

  save() {
    try { platform()?.setStorageSync(STORAGE_KEY, this.state); } catch (_) { /* 忽略存储容量和平台限制 */ }
  }

  isCompleted(levelId) { return Boolean(this.state.completed[levelId]); }

  isUnlocked(levels, index) {
    if (index <= 0) return true;
    return this.isCompleted(levels[index - 1].id);
  }

  complete(levelId, result) {
    const previous = this.state.best[levelId];
    const candidate = { moves: result.moves, elapsedMs: result.elapsedMs, completedAt: Date.now() };
    if (!previous || candidate.moves < previous.moves || (candidate.moves === previous.moves && candidate.elapsedMs < previous.elapsedMs)) this.state.best[levelId] = candidate;
    this.state.completed[levelId] = { completedAt: Date.now() };
    this.state.lastLevelId = levelId;
    this.save();
  }

  setLastLevel(levelId) { this.state.lastLevelId = levelId; this.save(); }

  reset() { this.state = { version: 1, completed: {}, best: {}, lastLevelId: null }; this.save(); }
}

module.exports = { ProgressStore };
