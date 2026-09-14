class MemoryStorageAdapter {
  constructor(initial = {}) { this.values = { ...initial }; }
  get(key) { return this.values[key]; }
  set(key, value) { this.values[key] = value; return true; }
  remove(key) { delete this.values[key]; return true; }
}

class WeChatStorageAdapter {
  constructor(api = typeof wx === "undefined" ? null : wx) { this.api = api; }
  get(key) { try { return this.api?.getStorageSync?.(key); } catch (_) { return undefined; } }
  set(key, value) { try { this.api?.setStorageSync?.(key, value); return true; } catch (_) { return false; } }
  remove(key) { try { this.api?.removeStorageSync?.(key); return true; } catch (_) { return false; } }
}

module.exports = { MemoryStorageAdapter, WeChatStorageAdapter };
